# VTracer (vendor)

Silnik wektoryzacji modułu Wektoryzator: [VTracer](https://github.com/visioncortex/vtracer) © visioncortex,
licencja MIT OR Apache-2.0. Pliki w tym katalogu są generowane przez `pnpm sync:vtracer` z paczki
`@visioncortex/vtracer@1.0.0-alpha.4` — nie edytuj ich ręcznie.

- `vtracer-wasm.js` — glue wasm-bindgen przepisany na ESM z `initSync(bytes)` (oryginał czyta .wasm przez `fs`).
- `public/wasm/vtracer-1.0.0-alpha.4.wasm` — binarka WebAssembly (sha256 `63716b70497b7468ef97545b50f5f34b8bbb7acde2d7b00deb4eb40781446d45`).

Glue i binarka muszą pochodzić z tego samego builda: po podbiciu wersji paczki uruchom skrypt ponownie.
