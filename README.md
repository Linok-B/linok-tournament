# Linok-B's Local Tournament Manager

A fully client-side, zero-dependency tournament management web application. Designed for privacy and customization.

## Features
* **100% Local & Private:** No servers, accounts, or tracking. Everything runs and saves locally in your browser.
* **Supported Formats:** Single Elimination, Double Elimination, Round Robin, Swiss, and custom Dynamic Power-Weighted (DPW) Rating Swiss.
* **Advanced Tiebreaker Builder:** Manual rule stacking (Match Points, Game Differential, H2H, Buchholz, Median Buchholz, ELO, Registration Seed, (...), and accurate placements).
* **Multi-Stage Pipeline:** Seamlessly string formats together (e.g., Swiss into a Single Elim w/ Top 8 Cut).
* **Theme Engine:** Fully customizable UI supporting Modern (Cards), Classic (Flat), and entirely custom HEX color palettes.
* **Streamer Mode:** Instantly hides controls and expands the bracket for easy OBS window-capture.
* **Data Management:** Native JSON Export/Import capabilities for saving tournaments or sharing states.

## Usage
Website live at [linok-tournament](https://linok-b.github.io/linok-tournament/index.html). No installation or local server required.

<3

## Acknowledgements

This project utilizes code from the following open-source projects:

- **[MiniSat](https://github.com/niklasso/minisat)**: A minimalistic and high-performance SAT solver. MiniSat-derived code is included in four of the five WebAssembly (.wasm) modules and their corresponding JavaScript (.js) files located in ./js/engine/matchmakers/modules/.
- **[Emscripten](https://github.com/emscripten-core/emsdk)**: An open-source compiler toolchain for compiling C/C++ to WebAssembly. Emscripten-generated code is included in the WebAssembly (.wasm) modules and their corresponding JavaScript (.js) files located in ./js/engine/matchmakers/modules/.

Portions of this software are copyright by their respective authors and are used under the MIT License. See the [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) file for the applicable copyright notices and license details.
