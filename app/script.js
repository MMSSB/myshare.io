// document.addEventListener('DOMContentLoaded', () => {
//     // --- 1. PERSISTENT IDENTITY ---
//     let myUUID = localStorage.getItem('ws_uuid');
//     if (!myUUID) {
//         myUUID = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
//         localStorage.setItem('ws_uuid', myUUID);
//     }

//     const defaultDevice = window.innerWidth < 768 ? 'mobile' : 'laptop';

//     let appState = {
//         name: localStorage.getItem('ws_name') || 'My Device',
//         deviceType: localStorage.getItem('ws_device') || defaultDevice,
//         theme: localStorage.getItem('ws_theme') || 'system',
//         autoAccept: localStorage.getItem('ws_auto_accept') === 'true',
//         history: JSON.parse(localStorage.getItem('ws_history')) || [],
//         knownPeers: JSON.parse(localStorage.getItem('ws_peers')) || {}
//     };

//     // --- 2. DOM ELEMENTS ---
//     const UI = {
//         tabs: document.querySelectorAll('.tab-content'),
//         navBtns: document.querySelectorAll('.nav-btn'),
//         statusPill: document.getElementById('global-status'),
//         statusText: document.getElementById('status-text'),
//         myId: document.getElementById('my-id'),
//         myName: document.getElementById('my-name'),
//         grid: document.getElementById('device-grid'),
//         workspace: document.getElementById('active-workspace'),
//         targetName: document.getElementById('target-name'),
//         targetIcon: document.getElementById('target-icon'),
//         historyBody: document.getElementById('history-body'),
//         fileInput: document.getElementById('file-input'),
//         uploadZone: document.getElementById('upload-zone'),
//         dropOverlay: document.getElementById('drop-overlay'),
//         transferQueue: document.getElementById('transfer-queue'),
        
//         // Modals
//         pairModal: document.getElementById('pair-modal'),
//         editModal: document.getElementById('edit-modal'),
//         confirmSendModal: document.getElementById('confirm-send-modal'),
//         incomingModal: document.getElementById('incoming-modal'),
//         contextMenu: document.getElementById('context-menu')
//     };

//     let contextMenuTargetUUID = null;
//     let pendingFilesToSend = [];
//     let pendingIncomingOffer = null; // { transferId, name, size, mime }
//     let simulatedTimers = {}; // Holds transfer progress timers

//     // --- 3. PEERJS SETUP (THE REFRESH FIX) ---
//     let myCode = localStorage.getItem('ws_my_code');
//     if (!myCode) {
//         myCode = Math.floor(1000 + Math.random() * 9000).toString();
//         localStorage.setItem('ws_my_code', myCode);
//     }

//     const peer = new Peer(myCode);
//     let activeConn = null;

//     peer.on('open', id => {
//         UI.myId.innerText = id;
//         UI.statusText.innerText = "Ready to pair";
//         initUI();
//     });

//     peer.on('error', err => {
//         console.error("PeerJS Error:", err);
//         if (err.type === 'unavailable-id') {
//             myCode = Math.floor(1000 + Math.random() * 9000).toString();
//             localStorage.setItem('ws_my_code', myCode);
//             location.reload();
//         } else {
//             UI.statusText.innerText = "Network Error";
//             document.querySelector('.pulse-dot').style.background = 'var(--danger)';
//         }
//     });

//     // Cleanup on refresh to free the ID instantly
//     window.addEventListener('beforeunload', () => {
//         if (activeConn) activeConn.close();
//         if (peer) peer.destroy();
//     });
//     window.addEventListener('pagehide', () => {
//         if(peer) peer.destroy();
//     });

//     // --- 4. CONNECTION & PROTOCOL LOGIC ---
//     peer.on('connection', conn => {
//         setupConnection(conn);
//     });

//     window.connectToPeer = function() {
//         const target = document.getElementById('pair-input').value.trim();
//         if (target === myCode || target.length !== 4) return alert("Invalid Code");
        
//         UI.statusText.innerText = "Connecting...";
//         const conn = peer.connect(target);
//         setupConnection(conn);
//         closeModals();
//     };

//     function setupConnection(conn) {
//         conn.on('open', () => {
//             conn.send({ type: 'identity', uuid: myUUID, name: appState.name, deviceType: appState.deviceType });
//         });

//         conn.on('data', data => {
//             switch(data.type) {
//                 case 'identity':
//                     saveKnownPeer(data.uuid, conn.peer, data.name, data.deviceType);
//                     finalizeConnection(conn, data.name, data.deviceType);
//                     break;
                
//                 // OFFER / ACCEPT PROTOCOL
//                 case 'file_offer':
//                     handleFileOffer(data, conn);
//                     break;
//                 case 'file_accept':
//                     beginFileTransfer(data.transferId);
//                     break;
//                 case 'file_decline':
//                     markTransferStatus(data.transferId, 'Declined', 'declined');
//                     break;
//                 case 'file_data':
//                     handleReceivedFileData(data);
//                     break;
//                 case 'file_complete':
//                     markTransferStatus(data.transferId, 'Complete', 'done');
//                     break;
//             }
//         });

//         conn.on('close', () => {
//             if (activeConn && activeConn.peer === conn.peer) {
//                 activeConn = null;
//                 updateWorkspaceState(false);
//             }
//         });
//     }

//     function finalizeConnection(conn, nameOverride = null, typeOverride = null) {
//         activeConn = conn;
//         const known = Object.values(appState.knownPeers).find(p => p.lastCode === conn.peer);
//         const displayName = nameOverride || (known ? known.name : `Device ${conn.peer}`);
//         const displayType = typeOverride || (known ? known.deviceType : 'laptop');

//         UI.statusText.innerText = "Connected";
//         UI.statusPill.classList.add('connected');
//         UI.workspace.classList.remove('hidden');
//         UI.targetName.innerText = displayName;
//         UI.targetIcon.className = `ph-fill ${getIconClass(displayType)}`;
//         UI.transferQueue.innerHTML = ''; // Clear queue on new connection
//     }

//     window.disconnectAll = function() {
//         if (activeConn) activeConn.close();
//         activeConn = null;
//         updateWorkspaceState(false);
//     };

//     // --- 5. FILE TRANSFER (OFFER / ACCEPT FLOW) ---

//     // A. Sending Flow
//     UI.uploadZone.onclick = () => UI.fileInput.click();
//     UI.fileInput.onchange = e => { if(e.target.files.length > 0) promptSend(e.target.files); };

//     let dragCounter = 0;
//     window.ondragenter = e => { e.preventDefault(); if (!activeConn) return; dragCounter++; UI.dropOverlay.classList.remove('overlay-hidden'); };
//     window.ondragleave = e => { e.preventDefault(); dragCounter--; if (dragCounter === 0) UI.dropOverlay.classList.add('overlay-hidden'); };
//     window.ondragover = e => e.preventDefault();
//     window.ondrop = e => {
//         e.preventDefault(); dragCounter = 0; UI.dropOverlay.classList.add('overlay-hidden');
//         if (activeConn && e.dataTransfer.files.length > 0) promptSend(e.dataTransfer.files);
//     };

//     function promptSend(files) {
//         pendingFilesToSend = Array.from(files);
//         const totalSize = pendingFilesToSend.reduce((acc, file) => acc + file.size, 0);
//         document.getElementById('confirm-send-text').innerText = `Send ${pendingFilesToSend.length} file(s) (${formatBytes(totalSize)}) to ${UI.targetName.innerText}?`;
//         UI.confirmSendModal.classList.remove('hidden');
//     }

//     window.cancelSend = function() {
//         pendingFilesToSend = [];
//         UI.fileInput.value = '';
//         closeModals();
//     };

//     document.getElementById('confirm-send-btn').onclick = () => {
//         closeModals();
//         pendingFilesToSend.forEach(file => {
//             const transferId = 'tx_' + Date.now() + '_' + Math.floor(Math.random()*1000);
            
//             // 1. Add to local queue UI
//             createQueueItem(transferId, file.name, file.size, 'Waiting for acceptance...');
            
//             // 2. Attach file object to DOM for later retrieval
//             document.getElementById(`qi-${transferId}`).fileObj = file;

//             // 3. Send Offer
//             activeConn.send({
//                 type: 'file_offer',
//                 transferId: transferId,
//                 name: file.name,
//                 size: file.size,
//                 mime: file.type
//             });
//         });
//         pendingFilesToSend = [];
//         UI.fileInput.value = '';
//     };

//     function beginFileTransfer(transferId) {
//         const qi = document.getElementById(`qi-${transferId}`);
//         if(!qi || !qi.fileObj) return;
        
//         const file = qi.fileObj;
//         markTransferStatus(transferId, 'Sending...', '');
//         simulateProgress(transferId, file.size); // Start fake progress bar

//         file.arrayBuffer().then(buffer => {
//             activeConn.send({
//                 type: 'file_data',
//                 transferId: transferId,
//                 name: file.name,
//                 size: file.size,
//                 mime: file.type,
//                 payload: buffer
//             });
//         });
//     }

//     // B. Receiving Flow
//     function handleFileOffer(data, conn) {
//         const isKnown = Object.values(appState.knownPeers).some(p => p.lastCode === conn.peer);
        
//         createQueueItem(data.transferId, data.name, data.size, 'Incoming offer...');

//         if (appState.autoAccept && isKnown) {
//             // Auto Accept
//             markTransferStatus(data.transferId, 'Receiving...', '');
//             simulateProgress(data.transferId, data.size);
//             conn.send({ type: 'file_accept', transferId: data.transferId });
//         } else {
//             // Prompt User
//             pendingIncomingOffer = data;
//             document.getElementById('incoming-text').innerText = `${UI.targetName.innerText} is sending "${data.name}" (${formatBytes(data.size)}).`;
//             UI.incomingModal.classList.remove('hidden');
//         }
//     }

//     document.getElementById('accept-file-btn').onclick = () => {
//         if(pendingIncomingOffer && activeConn) {
//             const id = pendingIncomingOffer.transferId;
//             markTransferStatus(id, 'Receiving...', '');
//             simulateProgress(id, pendingIncomingOffer.size);
//             activeConn.send({ type: 'file_accept', transferId: id });
//         }
//         closeModals();
//     };

//     document.getElementById('decline-file-btn').onclick = () => {
//         if(pendingIncomingOffer && activeConn) {
//             const id = pendingIncomingOffer.transferId;
//             markTransferStatus(id, 'Declined', 'declined');
//             activeConn.send({ type: 'file_decline', transferId: id });
//         }
//         closeModals();
//     };

//     function handleReceivedFileData(data) {
//         // Trigger download
//         const blob = new Blob([data.payload], { type: data.mime });
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = data.name;
//         a.click();
//         URL.revokeObjectURL(url);

//         // Complete UI and log
//         finishProgress(data.transferId);
//         markTransferStatus(data.transferId, 'Complete', 'done');
//         logHistory(data.name, data.size, 'Received');
//         activeConn.send({ type: 'file_complete', transferId: data.transferId });
//     }

//     // --- 6. ANIMATED QUEUE UI ---
//     function createQueueItem(id, name, size, initialStatus) {
//         const el = document.createElement('div');
//         el.className = 'queue-item';
//         el.id = `qi-${id}`;
//         el.innerHTML = `
//             <div class="qi-header">
//                 <span>${name} <small style="color:var(--text-muted); font-weight:normal;">(${formatBytes(size)})</small></span>
//                 <span class="qi-status" id="status-${id}">${initialStatus}</span>
//             </div>
//             <div class="progress-track"><div class="progress-fill" id="prog-${id}"></div></div>
//         `;
//         UI.transferQueue.prepend(el);
//     }

//     function markTransferStatus(id, text, cssClass) {
//         const el = document.getElementById(`status-${id}`);
//         if(el) {
//             el.innerText = text;
//             el.className = `qi-status ${cssClass}`;
//             if(cssClass === 'declined' || cssClass === 'done') {
//                 clearInterval(simulatedTimers[id]);
//             }
//         }
//     }

//     function simulateProgress(id, sizeBytes) {
//         // Assume ~10MB/s local speed for the animation curve
//         const estMs = Math.max(1000, (sizeBytes / (10 * 1024 * 1024)) * 1000);
//         let prog = 0;
//         const bar = document.getElementById(`prog-${id}`);
//         if(!bar) return;

//         simulatedTimers[id] = setInterval(() => {
//             prog += (100 / (estMs / 100)); // Update every 100ms
//             if(prog > 90) prog = 90; // Hold at 90% until complete signal
//             bar.style.width = `${prog}%`;
//         }, 100);
//     }

//     function finishProgress(id) {
//         clearInterval(simulatedTimers[id]);
//         const bar = document.getElementById(`prog-${id}`);
//         if(bar) bar.style.width = `100%`;
//     }

//     // --- 7. RADAR & CONTEXT MENU ---
//     function saveKnownPeer(uuid, currentCode, name, deviceType) {
//         if(!uuid) return;
//         const existingName = appState.knownPeers[uuid] ? appState.knownPeers[uuid].name : name;
//         appState.knownPeers[uuid] = { name: existingName, lastCode: currentCode, deviceType: deviceType || 'laptop' };
//         localStorage.setItem('ws_peers', JSON.stringify(appState.knownPeers));
//         renderRadar();
//     }

//     let pressTimer;
//     function openContextMenu(e, uuid) {
//         e.preventDefault();
//         contextMenuTargetUUID = uuid;
//         const menuWidth = 180; 
//         let x = e.clientX || (e.touches && e.touches[0].clientX);
//         let y = e.clientY || (e.touches && e.touches[0].clientY);
//         if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
//         UI.contextMenu.style.left = `${x}px`;
//         UI.contextMenu.style.top = `${y}px`;
//         UI.contextMenu.classList.remove('hidden');
//     }

//     window.addEventListener('click', (e) => {
//         if (!e.target.closest('#context-menu')) UI.contextMenu.classList.add('hidden');
//     });

//     document.getElementById('cm-connect').onclick = () => {
//         const peerObj = appState.knownPeers[contextMenuTargetUUID];
//         if(peerObj) { document.getElementById('pair-input').value = peerObj.lastCode; connectToPeer(); }
//         UI.contextMenu.classList.add('hidden');
//     };

//     document.getElementById('cm-delete').onclick = () => {
//         const peerObj = appState.knownPeers[contextMenuTargetUUID];
//         if (confirm(`Remove "${peerObj.name}"?`)) {
//             delete appState.knownPeers[contextMenuTargetUUID];
//             localStorage.setItem('ws_peers', JSON.stringify(appState.knownPeers));
//             renderRadar();
//         }
//         UI.contextMenu.classList.add('hidden');
//     };

//     document.getElementById('cm-edit').onclick = () => {
//         const peerObj = appState.knownPeers[contextMenuTargetUUID];
//         document.getElementById('edit-name-input').value = peerObj.name;
//         UI.editModal.classList.remove('hidden');
//         UI.contextMenu.classList.add('hidden');
//     };

//     document.getElementById('save-edit-btn').onclick = () => {
//         const newName = document.getElementById('edit-name-input').value.trim();
//         if(newName && contextMenuTargetUUID) {
//             appState.knownPeers[contextMenuTargetUUID].name = newName;
//             localStorage.setItem('ws_peers', JSON.stringify(appState.knownPeers));
//             renderRadar();
//         }
//         closeModals();
//     };

//     function renderRadar() {
//         const addBtn = UI.grid.firstElementChild;
//         UI.grid.innerHTML = '';
//         UI.grid.appendChild(addBtn);

//         Object.entries(appState.knownPeers).forEach(([uuid, peerObj]) => {
//             const node = document.createElement('div');
//             node.className = 'device-node';
//             node.innerHTML = `<div class="node-avatar"><i class="ph-fill ${getIconClass(peerObj.deviceType)}"></i></div><span>${peerObj.name}</span>`;
            
//             node.onclick = (e) => {
//                 if(e.type === 'click') { document.getElementById('pair-input').value = peerObj.lastCode; connectToPeer(); }
//             };
//             node.oncontextmenu = (e) => openContextMenu(e, uuid);
//             node.ontouchstart = (e) => { pressTimer = setTimeout(() => { openContextMenu(e, uuid); }, 600); };
//             node.ontouchend = () => clearTimeout(pressTimer);
//             node.ontouchmove = () => clearTimeout(pressTimer);

//             UI.grid.appendChild(node);
//         });
//     }

//     // --- 8. UTILITIES & INITIALIZATION ---
//     function initUI() {
//         UI.myName.innerText = appState.name;
//         document.getElementById('set-name').value = appState.name;
//         document.getElementById('set-device-type').value = appState.deviceType;
//         document.getElementById('set-theme').value = appState.theme;
//         document.getElementById('set-auto-accept').checked = appState.autoAccept;
//         applyTheme(appState.theme);
//         renderRadar();
//         renderHistory();
//     }

//     function updateWorkspaceState(isConnected) {
//         if (!isConnected) {
//             UI.statusText.innerText = "Ready to pair";
//             UI.statusPill.classList.remove('connected');
//             UI.workspace.classList.add('hidden');
//         }
//     }

//     function getIconClass(type) {
//         if (type === 'mobile') return 'ph-device-mobile';
//         if (type === 'desktop') return 'ph-desktop';
//         return 'ph-laptop';
//     }

//     function formatBytes(bytes) {
//         if (bytes === 0) return '0 B';
//         const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
//         return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
//     }

//     function logHistory(name, size, dir) {
//         appState.history.unshift({ name, size, dir, date: Date.now() });
//         if (appState.history.length > 50) appState.history.pop();
//         localStorage.setItem('ws_history', JSON.stringify(appState.history));
//         renderHistory();
//     }

//     function renderHistory() {
//         if (appState.history.length === 0) {
//             UI.historyBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted)">No transfers yet.</td></tr>`;
//             return;
//         }
//         UI.historyBody.innerHTML = appState.history.map(h => {
//             const d = new Date(h.date);
//             return `<tr>
//                 <td><strong>${h.name}</strong></td>
//                 <td>${formatBytes(h.size)}</td>
//                 <td><span class="tag ${h.dir === 'Sent' ? 'sent' : 'recv'}">${h.dir}</span></td>
//                 <td style="color:var(--text-muted); font-size:0.85rem;">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} <br><small>${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></td>
//                 <td style="color: var(--success); font-weight: 600;">Complete</td>
//             </tr>`;
//         }).join('');
//     }

//     UI.navBtns.forEach(btn => {
//         btn.onclick = () => {
//             UI.navBtns.forEach(b => b.classList.remove('active'));
//             UI.tabs.forEach(t => t.classList.remove('active'));
//             btn.classList.add('active');
//             document.getElementById(btn.dataset.tab).classList.add('active');
//         };
//     });

//     window.saveSettings = function() {
//         appState.name = document.getElementById('set-name').value || 'My Device';
//         appState.deviceType = document.getElementById('set-device-type').value;
//         appState.theme = document.getElementById('set-theme').value;
//         appState.autoAccept = document.getElementById('set-auto-accept').checked;
        
//         localStorage.setItem('ws_name', appState.name);
//         localStorage.setItem('ws_device', appState.deviceType);
//         localStorage.setItem('ws_theme', appState.theme);
//         localStorage.setItem('ws_auto_accept', appState.autoAccept);
        
//         initUI();
//         alert("Settings Saved!");
//     };

//     function applyTheme(theme) {
//         if (theme === 'system') document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
//         else document.documentElement.setAttribute('data-theme', theme);
//     }

//     window.openModal = (id) => UI[id.replace('-modal', 'Modal')].classList.remove('hidden');
//     window.closeModals = () => {
//         UI.pairModal.classList.add('hidden');
//         UI.editModal.classList.add('hidden');
//         UI.confirmSendModal.classList.add('hidden');
//         UI.incomingModal.classList.add('hidden');
//     };
// });
















document.addEventListener('DOMContentLoaded', () => {
    // --- 1. PERSISTENT IDENTITY ---
    let myUUID = localStorage.getItem('ws_uuid');
    if (!myUUID) {
        myUUID = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        localStorage.setItem('ws_uuid', myUUID);
    }

    const defaultDevice = window.innerWidth < 768 ? 'mobile' : 'laptop';

    let appState = {
        name: localStorage.getItem('ws_name') || 'My Device',
        deviceType: localStorage.getItem('ws_device') || defaultDevice,
        theme: localStorage.getItem('ws_theme') || 'system',
        autoAccept: localStorage.getItem('ws_auto_accept') === 'true',
        history: JSON.parse(localStorage.getItem('ws_history')) || [],
        knownPeers: JSON.parse(localStorage.getItem('ws_peers')) || {}
    };

    // --- 2. DOM ELEMENTS ---
    const UI = {
        tabs: document.querySelectorAll('.tab-content'),
        navBtns: document.querySelectorAll('.nav-btn'),
        statusPill: document.getElementById('global-status'),
        statusText: document.getElementById('status-text'),
        myId: document.getElementById('my-id'),
        myName: document.getElementById('my-name'),
        grid: document.getElementById('device-grid'),
        workspace: document.getElementById('active-workspace'),
        targetName: document.getElementById('target-name'),
        targetIcon: document.getElementById('target-icon'),
        historyBody: document.getElementById('history-body'),
        fileInput: document.getElementById('file-input'),
        uploadZone: document.getElementById('upload-zone'),
        dropOverlay: document.getElementById('drop-overlay'),
        transferQueue: document.getElementById('transfer-queue'),
        pairModal: document.getElementById('pair-modal'),
        editModal: document.getElementById('edit-modal'),
        confirmSendModal: document.getElementById('confirm-send-modal'),
        incomingModal: document.getElementById('incoming-modal'),
        contextMenu: document.getElementById('context-menu')
    };

    let contextMenuTargetUUID = null;
    let pendingFilesToSend = [];
    let pendingIncomingOffer = null; // { transferId, name, size, mime, conn }
    let activeConn = null;           // current active connection

    // Store active transfers metadata for chunked reassembly
    let receiveBuffers = {};    // transferId -> { chunks: [], expectedSize, mime, name }

    // --- 3. PEERJS SETUP (STABLE ID) ---
    let myCode = localStorage.getItem('ws_my_code');
    if (!myCode) {
        myCode = Math.floor(1000 + Math.random() * 9000).toString();
        localStorage.setItem('ws_my_code', myCode);
    }

    const peer = new Peer(myCode);
    let peerInitialized = false;

    peer.on('open', id => {
        UI.myId.innerText = id;
        UI.statusText.innerText = "Ready to pair";
        if (!peerInitialized) {
            initUI();
            peerInitialized = true;
        }
    });

    peer.on('error', err => {
        console.error("PeerJS Error:", err);
        if (err.type === 'unavailable-id') {
            myCode = Math.floor(1000 + Math.random() * 9000).toString();
            localStorage.setItem('ws_my_code', myCode);
            location.reload();
        } else {
            UI.statusText.innerText = "Network Error";
            document.querySelector('.pulse-dot').style.background = 'var(--danger)';
        }
    });

    // Cleanup on refresh
    window.addEventListener('beforeunload', () => {
        if (activeConn) activeConn.close();
        if (peer && !peer.destroyed) peer.destroy();
    });
    window.addEventListener('pagehide', () => {
        if (peer && !peer.destroyed) peer.destroy();
    });

    // --- 4. CONNECTION & PROTOCOL LOGIC (CHUNKED TRANSFER) ---
    peer.on('connection', conn => {
        setupConnection(conn);
    });

    window.connectToPeer = function () {
        const target = document.getElementById('pair-input').value.trim();
        if (target === myCode || target.length !== 4) return alert("Invalid Code");
        UI.statusText.innerText = "Connecting...";
        const conn = peer.connect(target);
        setupConnection(conn);
        closeModals();
    };

    function setupConnection(conn) {
        conn.on('open', () => {
            conn.send({ type: 'identity', uuid: myUUID, name: appState.name, deviceType: appState.deviceType });
        });

        conn.on('data', data => {
            switch (data.type) {
                case 'identity':
                    saveKnownPeer(data.uuid, conn.peer, data.name, data.deviceType);
                    finalizeConnection(conn, data.name, data.deviceType);
                    break;
                case 'file_offer':
                    handleFileOffer(data, conn);
                    break;
                case 'file_accept':
                    beginFileTransfer(data.transferId, conn);
                    break;
                case 'file_decline':
                    markTransferStatus(data.transferId, 'Declined', 'declined');
                    break;
                case 'file_chunk':
                    handleFileChunk(data);
                    break;
                case 'file_complete':
                    markTransferStatus(data.transferId, 'Complete', 'done');
                    finishProgress(data.transferId);
                    break;
                default:
                    break;
            }
        });

        conn.on('close', () => {
            if (activeConn && activeConn.peer === conn.peer) {
                activeConn = null;
                updateWorkspaceState(false);
            }
        });

        conn.on('error', (err) => {
            console.error("Connection error:", err);
            if (activeConn && activeConn.peer === conn.peer) {
                activeConn = null;
                updateWorkspaceState(false);
                UI.statusText.innerText = "Connection lost";
            }
        });
    }

    function finalizeConnection(conn, nameOverride = null, typeOverride = null) {
        // Close any previous active connection to keep only one
        if (activeConn && activeConn !== conn && activeConn.open) {
            activeConn.close();
        }
        activeConn = conn;
        const known = Object.values(appState.knownPeers).find(p => p.lastCode === conn.peer);
        const displayName = nameOverride || (known ? known.name : `Device ${conn.peer}`);
        const displayType = typeOverride || (known ? known.deviceType : 'laptop');

        UI.statusText.innerText = "Connected";
        UI.statusPill.classList.add('connected');
        UI.workspace.classList.remove('hidden');
        UI.targetName.innerText = displayName;
        UI.targetIcon.className = `ph-fill ${getIconClass(displayType)}`;
        UI.transferQueue.innerHTML = '';
    }

    window.disconnectAll = function () {
        if (activeConn) {
            activeConn.close();
            activeConn = null;
        }
        updateWorkspaceState(false);
    };

    function updateWorkspaceState(isConnected) {
        if (!isConnected) {
            UI.statusText.innerText = "Ready to pair";
            UI.statusPill.classList.remove('connected');
            UI.workspace.classList.add('hidden');
        }
    }

    // --- 5. CHUNKED FILE SENDING ---
    const CHUNK_SIZE = 16 * 1024; // 16KB chunks – safe for WebRTC

    function sendFileChunks(transferId, file, conn) {
        const reader = new FileReader();
        let offset = 0;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        function sendNextChunk() {
            if (!conn || !conn.open) {
                markTransferStatus(transferId, 'Failed (disconnected)', 'declined');
                return;
            }
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        }

        reader.onload = (e) => {
            const chunkData = e.target.result;
            conn.send({
                type: 'file_chunk',
                transferId: transferId,
                chunk: chunkData,
                index: offset / CHUNK_SIZE,
                total: totalChunks,
                name: file.name,
                size: file.size,
                mime: file.type,
                last: (offset + CHUNK_SIZE >= file.size)
            });

            offset += CHUNK_SIZE;
            const percent = (offset / file.size) * 100;
            updateProgressBar(transferId, percent);

            if (offset < file.size) {
                sendNextChunk();
            } else {
                // All chunks sent, but we wait for file_complete from receiver
                markTransferStatus(transferId, 'Waiting for confirmation...', '');
            }
        };

        reader.onerror = () => {
            markTransferStatus(transferId, 'Failed to read file', 'declined');
        };

        sendNextChunk();
    }

    function handleFileChunk(data) {
        const { transferId, chunk, index, total, name, size, mime, last } = data;

        if (!receiveBuffers[transferId]) {
            receiveBuffers[transferId] = {
                chunks: new Array(total),
                receivedCount: 0,
                expectedSize: size,
                mime: mime,
                name: name
            };
            // Update UI to show receiving progress
            markTransferStatus(transferId, 'Receiving...', '');
        }

        const buffer = receiveBuffers[transferId];
        buffer.chunks[index] = chunk;
        buffer.receivedCount++;

        const percent = (buffer.receivedCount / total) * 100;
        updateProgressBar(transferId, percent);

        if (last) {
            // Reassemble file
            const fullBlob = new Blob(buffer.chunks, { type: buffer.mime });
            const url = URL.createObjectURL(fullBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = buffer.name;
            a.click();
            URL.revokeObjectURL(url);

            // Log received file
            logHistory(buffer.name, buffer.size, 'Received');

            // Clean up reassembly buffer
            delete receiveBuffers[transferId];

            // Mark transfer as complete in UI and send confirmation
            markTransferStatus(transferId, 'Complete', 'done');
            finishProgress(transferId);

            if (activeConn && activeConn.open) {
                activeConn.send({ type: 'file_complete', transferId: transferId });
            }
        }
    }

    // --- 6. SENDING FLOW (OFFER / ACCEPT) ---
    UI.uploadZone.onclick = () => UI.fileInput.click();
    UI.fileInput.onchange = e => {
        if (e.target.files && e.target.files.length > 0) {
            promptSend(e.target.files);
            // Clear input to allow re-selecting same file again
            UI.fileInput.value = '';
        }
    };

    // Drag & drop with better mobile detection
    let dragCounter = 0;
    window.ondragenter = e => {
        e.preventDefault();
        if (!activeConn) return;
        dragCounter++;
        UI.dropOverlay.classList.remove('overlay-hidden');
    };
    window.ondragleave = e => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) UI.dropOverlay.classList.add('overlay-hidden');
    };
    window.ondragover = e => e.preventDefault();
    window.ondrop = e => {
        e.preventDefault();
        dragCounter = 0;
        UI.dropOverlay.classList.add('overlay-hidden');
        if (activeConn && e.dataTransfer.files.length > 0) promptSend(e.dataTransfer.files);
    };

    function promptSend(files) {
        if (!activeConn) {
            alert("Not connected to any device.");
            return;
        }
        pendingFilesToSend = Array.from(files);
        const totalSize = pendingFilesToSend.reduce((acc, file) => acc + file.size, 0);
        document.getElementById('confirm-send-text').innerText = `Send ${pendingFilesToSend.length} file(s) (${formatBytes(totalSize)}) to ${UI.targetName.innerText}?`;
        UI.confirmSendModal.classList.remove('hidden');
    }

    window.cancelSend = function () {
        pendingFilesToSend = [];
        UI.fileInput.value = '';
        closeModals();
    };

    document.getElementById('confirm-send-btn').onclick = () => {
        closeModals();
        pendingFilesToSend.forEach(file => {
            const transferId = 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            createQueueItem(transferId, file.name, file.size, 'Waiting for acceptance...');
            // Store file reference on the queue item for later use
            const qi = document.getElementById(`qi-${transferId}`);
            if (qi) qi.fileObj = file;

            activeConn.send({
                type: 'file_offer',
                transferId: transferId,
                name: file.name,
                size: file.size,
                mime: file.type
            });
        });
        pendingFilesToSend = [];
        UI.fileInput.value = '';
    };

    function beginFileTransfer(transferId, conn) {
        const qi = document.getElementById(`qi-${transferId}`);
        if (!qi || !qi.fileObj) return;
        const file = qi.fileObj;
        markTransferStatus(transferId, 'Sending...', '');
        // Real progress will be updated during chunk sending
        sendFileChunks(transferId, file, conn);
        logHistory(file.name, file.size, 'Sent');
    }

    // --- 7. RECEIVING FLOW ---
    function handleFileOffer(data, conn) {
        const isKnown = Object.values(appState.knownPeers).some(p => p.lastCode === conn.peer);
        createQueueItem(data.transferId, data.name, data.size, 'Incoming offer...');

        if (appState.autoAccept && isKnown) {
            markTransferStatus(data.transferId, 'Receiving...', '');
            conn.send({ type: 'file_accept', transferId: data.transferId });
        } else {
            pendingIncomingOffer = { ...data, conn: conn };
            document.getElementById('incoming-text').innerHTML = `${UI.targetName.innerText} is sending:<br><strong>${data.name}</strong> (${formatBytes(data.size)})`;
            UI.incomingModal.classList.remove('hidden');
        }
    }

    document.getElementById('accept-file-btn').onclick = () => {
        if (pendingIncomingOffer && pendingIncomingOffer.conn) {
            const { transferId, conn } = pendingIncomingOffer;
            markTransferStatus(transferId, 'Receiving...', '');
            conn.send({ type: 'file_accept', transferId: transferId });
        }
        closeModals();
    };

    document.getElementById('decline-file-btn').onclick = () => {
        if (pendingIncomingOffer && pendingIncomingOffer.conn) {
            const { transferId, conn } = pendingIncomingOffer;
            markTransferStatus(transferId, 'Declined', 'declined');
            conn.send({ type: 'file_decline', transferId: transferId });
        }
        closeModals();
    };

    // --- 8. UI HELPERS (Queue, Progress, History) ---
    function createQueueItem(id, name, size, initialStatus) {
        const existing = document.getElementById(`qi-${id}`);
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.className = 'queue-item';
        el.id = `qi-${id}`;
        el.innerHTML = `
            <div class="qi-header">
                <span>${escapeHtml(name)} <small style="color:var(--text-muted); font-weight:normal;">(${formatBytes(size)})</small></span>
                <span class="qi-status" id="status-${id}">${initialStatus}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" id="prog-${id}"></div></div>
        `;
        UI.transferQueue.prepend(el);
    }

    function updateProgressBar(id, percent) {
        const bar = document.getElementById(`prog-${id}`);
        if (bar) bar.style.width = `${Math.min(100, percent)}%`;
    }

    function finishProgress(id) {
        const bar = document.getElementById(`prog-${id}`);
        if (bar) bar.style.width = `100%`;
    }

    function markTransferStatus(id, text, cssClass) {
        const el = document.getElementById(`status-${id}`);
        if (el) {
            el.innerText = text;
            el.className = `qi-status ${cssClass}`;
        }
        // If transfer is done or declined, we can optionally remove it after a delay
        if (cssClass === 'declined' || cssClass === 'done') {
            setTimeout(() => {
                const item = document.getElementById(`qi-${id}`);
                if (item) item.style.opacity = '0.5';
            }, 1000);
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function (m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function logHistory(name, size, dir) {
        appState.history.unshift({ name, size, dir, date: Date.now() });
        if (appState.history.length > 50) appState.history.pop();
        localStorage.setItem('ws_history', JSON.stringify(appState.history));
        renderHistory();
    }

    function renderHistory() {
        if (!appState.history.length) {
            UI.historyBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted)">No transfers yet.</td></tr>`;
            return;
        }
        UI.historyBody.innerHTML = appState.history.map(h => {
            const d = new Date(h.date);
            return `<tr>
                        <td><strong>${escapeHtml(h.name)}</strong></td>
                        <td>${formatBytes(h.size)}</td>
                        <td><span class="tag ${h.dir === 'Sent' ? 'sent' : 'recv'}">${h.dir}</span></td>
                        <td style="color:var(--text-muted); font-size:0.85rem;">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} <br><small>${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></td>
                        <td style="color: var(--success); font-weight: 600;">Complete</td>
                    </tr>`;
        }).join('');
    }

    // --- 9. RADAR & CONTEXT MENU (unchanged logic, adapted) ---
    function saveKnownPeer(uuid, currentCode, name, deviceType) {
        if (!uuid) return;
        const existingName = appState.knownPeers[uuid] ? appState.knownPeers[uuid].name : name;
        appState.knownPeers[uuid] = { name: existingName, lastCode: currentCode, deviceType: deviceType || 'laptop' };
        localStorage.setItem('ws_peers', JSON.stringify(appState.knownPeers));
        renderRadar();
    }

    let pressTimer;
    function openContextMenu(e, uuid) {
        e.preventDefault();
        contextMenuTargetUUID = uuid;
        let x = e.clientX || (e.touches && e.touches[0].clientX);
        let y = e.clientY || (e.touches && e.touches[0].clientY);
        const menuWidth = 180;
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        UI.contextMenu.style.left = `${x}px`;
        UI.contextMenu.style.top = `${y}px`;
        UI.contextMenu.classList.remove('hidden');
    }

    window.addEventListener('click', (e) => {
        if (!e.target.closest('#context-menu')) UI.contextMenu.classList.add('hidden');
    });

    document.getElementById('cm-connect').onclick = () => {
        const peerObj = appState.knownPeers[contextMenuTargetUUID];
        if (peerObj) {
            document.getElementById('pair-input').value = peerObj.lastCode;
            connectToPeer();
        }
        UI.contextMenu.classList.add('hidden');
    };

    document.getElementById('cm-delete').onclick = () => {
        const peerObj = appState.knownPeers[contextMenuTargetUUID];
        if (confirm(`Remove "${peerObj.name}"?`)) {
            delete appState.knownPeers[contextMenuTargetUUID];
            localStorage.setItem('ws_peers', JSON.stringify(appState.knownPeers));
            renderRadar();
        }
        UI.contextMenu.classList.add('hidden');
    };

    document.getElementById('cm-edit').onclick = () => {
        const peerObj = appState.knownPeers[contextMenuTargetUUID];
        document.getElementById('edit-name-input').value = peerObj.name;
        UI.editModal.classList.remove('hidden');
        UI.contextMenu.classList.add('hidden');
    };

    document.getElementById('save-edit-btn').onclick = () => {
        const newName = document.getElementById('edit-name-input').value.trim();
        if (newName && contextMenuTargetUUID) {
            appState.knownPeers[contextMenuTargetUUID].name = newName;
            localStorage.setItem('ws_peers', JSON.stringify(appState.knownPeers));
            renderRadar();
        }
        closeModals();
    };

    function renderRadar() {
        const addBtn = UI.grid.firstElementChild;
        UI.grid.innerHTML = '';
        UI.grid.appendChild(addBtn);

        Object.entries(appState.knownPeers).forEach(([uuid, peerObj]) => {
            const node = document.createElement('div');
            node.className = 'device-node';
            node.innerHTML = `<div class="node-avatar"><i class="ph-fill ${getIconClass(peerObj.deviceType)}"></i></div><span>${escapeHtml(peerObj.name)}</span>`;
            node.onclick = () => {
                document.getElementById('pair-input').value = peerObj.lastCode;
                connectToPeer();
            };
            node.oncontextmenu = (e) => openContextMenu(e, uuid);
            node.ontouchstart = (e) => { pressTimer = setTimeout(() => openContextMenu(e, uuid), 600); };
            node.ontouchend = () => clearTimeout(pressTimer);
            node.ontouchmove = () => clearTimeout(pressTimer);
            UI.grid.appendChild(node);
        });
    }

    // --- 10. SETTINGS & INIT ---
    function initUI() {
        UI.myName.innerText = appState.name;
        document.getElementById('set-name').value = appState.name;
        document.getElementById('set-device-type').value = appState.deviceType;
        document.getElementById('set-theme').value = appState.theme;
        document.getElementById('set-auto-accept').checked = appState.autoAccept;
        applyTheme(appState.theme);
        renderRadar();
        renderHistory();
    }

    function getIconClass(type) {
        if (type === 'mobile') return 'ph-device-mobile';
        if (type === 'desktop') return 'ph-desktop';
        return 'ph-laptop';
    }

    window.saveSettings = function () {
        appState.name = document.getElementById('set-name').value || 'My Device';
        appState.deviceType = document.getElementById('set-device-type').value;
        appState.theme = document.getElementById('set-theme').value;
        appState.autoAccept = document.getElementById('set-auto-accept').checked;

        localStorage.setItem('ws_name', appState.name);
        localStorage.setItem('ws_device', appState.deviceType);
        localStorage.setItem('ws_theme', appState.theme);
        localStorage.setItem('ws_auto_accept', appState.autoAccept);

        initUI();
        alert("Settings Saved!");
    };

    function applyTheme(theme) {
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    window.openModal = (id) => {
        document.getElementById(id).classList.remove('hidden');
    };
    window.closeModals = () => {
        UI.pairModal.classList.add('hidden');
        UI.editModal.classList.add('hidden');
        UI.confirmSendModal.classList.add('hidden');
        UI.incomingModal.classList.add('hidden');
    };

    // Tab switching
    UI.navBtns.forEach(btn => {
        btn.onclick = () => {
            UI.navBtns.forEach(b => b.classList.remove('active'));
            UI.tabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        };
    });
});