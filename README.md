# My share

My share is a high-performance, responsive Peer-to-Peer (P2P) file-sharing application designed for the modern web. Built with WebRTC, it allows you to transfer files directly between devices without the need for a backend server, making it the perfect tool to host for free on GitHub Pages.

## 🚀 Key Features

* **Zero-Backend Architecture:** 100% static files. No databases, no server costs, and no file size limits (browser-dependent).
* **True P2P Privacy:** Files are transferred directly between devices via WebRTC. Data never touches a server.
* **Pro UI/UX:** A stunning, glassmorphic 3-column dashboard that adapts perfectly from desktop (drag-and-drop) to mobile (tap-and-hold menus).
* **Smart Radar:** An AirDrop-style interface that remembers your known devices and allows you to reconnect instantly.
* **Transfer History:** Persistent logging of all sent and received files with date/time stamps.
* **Cross-Platform Ready:** Auto-detects device types (Mobile, Laptop, Desktop) and uses appropriate UI icons.
* **Secure & Stable:** Robust reconnection logic, automated handshake protocols, and auto-accept options for trusted devices.

## 🛠 Tech Stack

* **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Glassmorphism).
* **Networking:** [PeerJS](https://peerjs.com/) for WebRTC signaling.
* **Icons:** [Phosphor Icons](https://phosphoricons.com/).

## 📱 How to Use

1. **Open:** Visit the live URL on two devices (works on the same network or different networks).
2. **Pair:** Enter the 4-digit code shown on the receiving device into the sender's interface.
3. **Send:** Simply drag and drop files onto the transfer zone or click to browse.
4. **Accept:** The receiver gets an instant notification to accept/decline the file.
5. **Manage:** Right-click (desktop) or Long-press (mobile) on any device card to rename, reconnect, or remove it.

## 🚀 Quick Deployment

1. Create a new GitHub Repository.
2. Upload `index.html`, `style.css`, and `script.js`.
3. Go to **Settings > Pages** in your repository.
4. Set the source to the `main` branch.
5. Your app will be live at `https://yourusername.github.io/your-repo-name/`

## 🛡 Security
My share prioritizes privacy. Because it uses WebRTC, the connection is end-to-end encrypted. We do not store, track, or intercept your files.

---

*Built with passion. Inspired by native sharing experiences.*
