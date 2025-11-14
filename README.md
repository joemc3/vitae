# Professional Website Builder

A desktop application for generating professional portfolio websites from user documents (resumes, PDFs, CVs, etc.). Built with **Tauri** (Rust backend) + **React** (UI) + **Next.js** (website generation).

## 🌟 Features

- **📁 Multi-format document support**: Markdown, DOCX, PDF, XLSX, PPTX
- **🤖 Three processing modes**:
  - **Manual Mode**: Extract text and manually fill in your portfolio
  - **Cloud AI Mode**: Use Claude, GPT-4, or Gemini to auto-generate content
  - **Local AI Mode**: Use Ollama or LM Studio for privacy-focused generation
- **🎨 Five professional themes**: Onyx (dark), Quartz (light), Serene (soft), Jade (nature), Coral (vibrant)
- **🔒 Secure API key storage**: OS-native credential managers (Keychain, Credential Manager, Secret Service)
- **⚡ Static website generation**: Fast, SEO-friendly, deployable anywhere

## 📊 Code Statistics

- **Total Source Files**: 99
- **Languages**:
  - **Rust**: 8 files, ~1,318 lines (backend processing)
  - **TypeScript**: 55 files, ~4,853 lines (UI + generator)
  - **JavaScript**: 6 files, ~149 lines
  - **CSS**: ~266 lines (theme styling)
  - **Documentation**: 12 Markdown files
- **Total Lines of Code**: ~6,586
- **Architecture**: Monorepo with 3 main components (Tauri backend, React UI, Next.js generator)

## 📋 Prerequisites

### Required Software

- **Node.js**: v20.x or later
- **npm**: v10.x or later
- **Rust**: v1.75.x or later (install via [rustup](https://rustup.rs/))
- **Tauri CLI**: `cargo install tauri-cli`

### Platform-Specific Dependencies

#### macOS
```bash
xcode-select --install
```

#### Windows
- Microsoft Visual C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

Follow: https://tauri.app/v1/guides/getting-started/prerequisites#windows

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup2.4-dev \
    libjavascriptcoregtk-4.0-dev
```

#### Linux (Fedora)
```bash
sudo dnf install -y \
    webkit2gtk4.0-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

#### Linux (Arch)
```bash
sudo pacman -S --needed \
    webkit2gtk \
    base-devel \
    curl \
    wget \
    file \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install UI dependencies
cd src-ui && npm install && cd ..

# Install generator dependencies
cd src-generator && npm install && cd ..
```

### 2. Generate Application Icons

```bash
./generate-icons.sh
```

This creates icons for macOS (.icns) and Windows (.ico) from the SVG source.

### 3. Run Development Server

```bash
# From project root
npm run dev
```

This starts both the Tauri backend and React frontend with hot reload.

### 4. Build for Production

```bash
npm run build
```

The installer will be in `src-tauri/target/release/bundle/`.

## 📁 Project Structure

```
professional-website-builder/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── commands.rs     # Tauri API commands
│   │   ├── document_parser.rs  # File parsing (.md, .docx, .pdf, etc.)
│   │   ├── llm_client.rs   # LLM API integration
│   │   ├── storage.rs      # Secure keychain storage
│   │   ├── validator.rs    # JSON validation
│   │   └── types.rs        # Rust data structures
│   └── Cargo.toml
├── src-ui/                 # React frontend (desktop app UI)
│   ├── src/
│   │   ├── components/     # 5 main screens
│   │   │   ├── FileIngestion.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── MainEditor.tsx
│   │   │   ├── ThemeSelection.tsx
│   │   │   └── GenerationSuccess.tsx
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Tauri API wrappers
│   │   └── App.tsx
│   └── package.json
├── src-generator/          # Next.js static site generator
│   ├── app/
│   │   ├── themes/         # 5 website themes
│   │   │   ├── onyx/       # Dark professional theme
│   │   │   ├── quartz/     # Light minimalist theme
│   │   │   ├── serene/     # Soft calming theme
│   │   │   ├── jade/       # Nature-inspired theme
│   │   │   └── coral/      # Vibrant modern theme
│   │   └── lib/
│   └── package.json
├── user-data/              # Created at runtime
│   ├── source-files/       # User's uploaded documents
│   ├── session.json        # Portfolio data
│   └── generated-site/     # Final website output
└── project_standards/      # Design documents

```

## 🔧 Development

### Run Individual Components

```bash
# UI only (for development)
npm run ui:dev

# Generator only (for testing themes)
npm run generator:dev

# Full Tauri app
npm run dev
```

### Testing Document Parsing

```bash
cd src-tauri
cargo test
```

### Linting

```bash
# TypeScript/React
cd src-ui && npm run lint
cd src-generator && npm run lint

# Rust
cd src-tauri && cargo clippy

# Format all code
npm run format
```

## 🎨 Theme Development

Each theme is self-contained in `src-generator/app/themes/[theme-name]/`:

```
themes/onyx/
├── page.tsx                # Main template
├── theme.config.json       # Metadata
├── components/             # Theme components
│   ├── Header.tsx
│   ├── Profile.tsx
│   ├── WorkExperience.tsx
│   ├── Projects.tsx
│   ├── Education.tsx
│   ├── Skills.tsx
│   └── Contact.tsx
└── thumbnail.png           # 400x300 preview
```

To create a new theme:
1. Copy an existing theme directory
2. Update `theme.config.json` with the new theme name
3. Customize colors in `page.tsx` and components
4. Create a new thumbnail
5. The theme will automatically appear in the UI

## 🤖 LLM Integration

### Supported Providers

- **Anthropic Claude** (Cloud)
- **OpenAI GPT-4** (Cloud)
- **Google Gemini** (Cloud)
- **Ollama** (Local)
- **LM Studio** (Local)

### API Keys

API keys are stored securely in:
- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: Secret Service (GNOME Keyring, KWallet)

Configure in **Settings** (⚙️ icon in the app).

## 📊 Data Structure

Portfolio data follows a strict JSON schema:

```typescript
{
  profile: {
    fullName: string;
    title: string;
    summary?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    website?: string;
    socialLinks?: { platform: string; url: string }[];
  };
  workExperience: Array<{
    company: string;
    title: string;
    startDate: string;  // YYYY-MM
    endDate: string;    // YYYY-MM or "Present"
    location?: string;
    responsibilities?: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate?: string; // YYYY
    endDate: string;    // YYYY
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  theme: {
    name: string;
  };
}
```

See `project_standards/Data Structure Specification.md` for details.

## 🔒 Security

- **No API keys in code**: All keys stored in OS-native secure storage
- **No plaintext secrets**: Environment files are gitignored
- **Sandboxed file access**: Tauri security policies enforced
- **HTTPS only**: All cloud API calls use HTTPS
- **Input validation**: All user data is validated before processing

## 📚 Documentation

Detailed specifications are in `project_standards/`:
- **Data Structure Specification.md** - Complete JSON schema
- **Technical Specification.md** - Architecture and tech stack
- **Product Requirements Document (PRD).md** - Features and requirements
- **UI_UX Design Document.md** - Screen layouts and user flows
- **IMPLEMENTATION_PLAN.md** - Phased development roadmap

## 🛠️ Troubleshooting

### Build Errors on Linux

If you get "libsoup-2.4 not found" or similar errors:

```bash
# Ubuntu/Debian
sudo apt install libsoup2.4-dev libjavascriptcoregtk-4.0-dev

# Fedora
sudo dnf install webkit2gtk4.0-devel

# Arch
sudo pacman -S webkit2gtk
```

### Icon Generation Fails

Ensure you have the Tauri CLI installed:

```bash
cargo install tauri-cli
```

### UI Not Updating

Clear the cache and restart:

```bash
cd src-ui
rm -rf node_modules dist
npm install
npm run dev
```

## 🤝 Contributing

This project follows best practices:

- **EditorConfig** for consistent formatting
- **Prettier** for code formatting (`.prettierrc`)
- **ESLint** for linting
- **Clippy** for Rust linting
- **TypeScript** strict mode enabled

Run formatters before committing:

```bash
npm run format
```

## 📄 License

[Add your license here]

## 🎯 Roadmap

- [x] Phase 1: Project scaffolding
- [x] Phase 2: Core functionality (Tier 1 - Manual mode)
- [x] Phase 3: AI integration (Tiers 2 & 3)
- [x] Phase 4: Themes and finalization
- [ ] Phase 5: Testing and documentation
- [ ] Additional themes
- [ ] Export to other formats (PDF resume generation)
- [ ] Custom domain deployment helpers
- [ ] Analytics integration options

## 📧 Support

For issues and feature requests, please create an issue in the repository.

---

**Built with** ❤️ **using Tauri, React, and Next.js**
