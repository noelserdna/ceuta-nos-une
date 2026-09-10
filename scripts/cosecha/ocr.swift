// Lee el texto que hay DENTRO de cada imagen: carteles, pancartas, marcas de agua.
//
// Hace falta porque lo que no queremos publicar muchas veces no está en el pie de
// la publicación sino pintado en la foto: una pancarta, el logo de un partido en
// un cartel, el © de una agencia. Usa el reconocedor de texto de macOS (Vision),
// que va en local y no manda ninguna imagen a ningún sitio.
//
//   swiftc -O scripts/cosecha/ocr.swift -o <salida>/ocr
//   <salida>/ocr <carpeta de imágenes> <lista de sha256> <salida.ndjson>
//
// Reanudable: lo que ya esté en el fichero de salida no se vuelve a leer.
import Foundation
import Vision
import ImageIO

let args = CommandLine.arguments
guard args.count == 4 else {
  FileHandle.standardError.write("uso: ocr <carpeta> <lista> <salida.ndjson>\n".data(using: .utf8)!)
  exit(1)
}
let carpeta = args[1], lista = args[2], salida = args[3]

var hechos = Set<String>()
if let previo = try? String(contentsOfFile: salida, encoding: .utf8) {
  for linea in previo.split(separator: "\n") {
    if let d = linea.data(using: .utf8),
       let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
       let sha = o["sha256"] as? String { hechos.insert(sha) }
  }
}

let shas = (try? String(contentsOfFile: lista, encoding: .utf8))?
  .split(separator: "\n").map(String.init).filter { !$0.isEmpty && !hechos.contains($0) } ?? []
FileManager.default.createFile(atPath: salida, contents: nil) // no pisa si existe
guard let fh = FileHandle(forWritingAtPath: salida) else { exit(1) }
fh.seekToEndOfFile()

for (n, sha) in shas.enumerated() {
  var fila: [String: Any] = ["sha256": sha]
  let url = URL(fileURLWithPath: "\(carpeta)/\(sha).webp")
  if let src = CGImageSourceCreateWithURL(url as CFURL, nil),
     let img = CGImageSourceCreateImageAtIndex(src, 0, nil) {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    // Castellano, catalán, gallego y euskera salen en los carteles municipales.
    req.recognitionLanguages = ["es-ES", "ca-ES", "gl-ES", "eu-ES", "en-US"]
    req.usesLanguageCorrection = true
    do {
      try VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
      let lineas = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }
      fila["texto"] = lineas.joined(separator: " | ")
    } catch { fila["error"] = "\(error)" }
  } else { fila["error"] = "no se pudo abrir" }

  if let d = try? JSONSerialization.data(withJSONObject: fila),
     var s = String(data: d, encoding: .utf8) {
    s += "\n"
    fh.write(s.data(using: .utf8)!)
  }
  if (n + 1) % 50 == 0 { print("\(n + 1)/\(shas.count)") }
}
fh.closeFile()
print("hecho: \(shas.count) imágenes leídas")
