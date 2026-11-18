# Verdant browser renderer, vendored

Source: https://github.com/afflom/verdant-engine/blob/c21176cf24c51d9a0de07f649cefe2ee4b522093/site/scene-renderer.mjs
Upstream exact commit: `c21176cf24c51d9a0de07f649cefe2ee4b522093`
Source Git blob SHA-1: `df76ec984aca0f295aead872ade68ce09be1c034`.
License: MIT OR Apache-2.0, at the option of the consumer.
This copy is under the MIT option. Original MIT license text is in `LICENSE-MIT`.

Only the 2D/3D renderer module is vendored for a small decorative prism.
The much larger native WebAssembly simulation, gameplay and network workers are
**not** bundled. The renderer makes no Qortara eligibility or verification decisions.
Changing the engine pin requires a reviewed source, license and browser requalification.
