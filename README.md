<p align="center">
  <img src="src/assets/logo.png" width="200" height="200" alt="Hamledger Logo">
</p>

# Hamledger

_If you find my work valuable, please consider to Sponsor or Donate!_

![image](./public/qso.png)
![image](./public/dxcluster.png) ![image](./public/logbook.png) ![image](./public/qso_detail.png)

A modern amateur radio logging application built with Vue 3, TypeScript, and Electron.
It just works.

## Description

Hamledger is a feature-rich amateur radio logging application designed for ham radio operators. It provides a modern, intuitive interface for logging QSOs (radio contacts), managing station information, and tracking various operating achievements. This is not a contest-grade logger (Hamledger Contest is in the making), but rather an everyday logger tool.

## Features

- **Real-time Rig Control**: Interface with popular amateur radio transceivers (Hamlib)
- **QSO Logging**: Easy and efficient contact logging with auto-fill capabilities, ADIF import-export
- **DX Cluster**: Quick and seamless selection of stations
- **S-Meter Display**: Real-time signal strength visualization
- **Propagation Data**: Current solar and propagation condition monitoring
- **UTC Clock**: Integrated UTC time display for accurate logging
- **Weather Information**: Local weather conditions display
- **Remote Station Info**: Quick access to contacted station details
- **WSJT-X Integration**: Can automatically log QSOs from WSJT-X
- **Modern UI**: Clean, intuitive interface built with Vue 3

## Technical Stack

- **Frontend**: Vue 3 with TypeScript
- **State Management**: Pinia
- **Build Tool**: Vite
- **Desktop Runtime**: Electron
- **Styling**: Custom CSS with modern design principles

## Documentation

For detailed usage instructions and complete functionality guide, see:
- [Tutorial (Hungarian)](TUTORIAL.md) - Teljes funkcionalitás útmutató magyar nyelven
- [Tutorial (English)](TUTORIAL_EN.md) - Complete functionality guide in English

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Getting Started with Development

### Prerequisites

- Node.js (v16 or later)
- npm package manager
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/valibali/hamledger.git

   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run app:dev
   ```

### Building for Production

1. Build the application:

   ```bash
   npm run app:build
   ```

2. Preview the production build:
   ```bash
   npm run app:preview
   ```

## Development

### Project Structure

```
hamlog/
├── src/
│   ├── components/     # Vue components
│   ├── store/         # Pinia stores
│   ├── electron/      # Electron main and preload scripts
│   └── assets/        # Static assets
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) with commercial clause. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The Vue.js team for the amazing framework
- The Electron team for making cross-platform desktop apps possible
- The amateur radio community for inspiration and feedback

All the best,
HA5XB Balazs
