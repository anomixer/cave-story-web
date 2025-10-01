// Handles mounting an emscripten filesystem backed by indexeddb, and optionally further backing it with Google Drive cloud sync if the user logs in with Google.

// Determine API and redirect paths based on hostname
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const apiPrefix = isLocal ? '' : '/api';
// The redirect_uri for the token exchange must EXACTLY match the one used to request the code.
// The local server has a /oauth endpoint. The CF function has /api/oauth.
const oauthRedirectPath = isLocal ? '/oauth' : '/api/oauth';
const fullRedirectUri = location.origin + oauthRedirectPath;


// Handle OAuth redirect url params oauthCode or oauthError from /oauth handler and verify nonce for security

const url = new URL(location.href);
if (url.searchParams.has('oauthError')) {
    console.error('oauth error:', url.searchParams.get('oauthError'));
    alert('Sorry, failed to authenticate with Google due to error: ' + url.searchParams.get('oauthError'));
    url.searchParams.delete('oauthError');
    url.searchParams.delete('nonce');
    history.replaceState(null, '', url.href);
}
if (url.searchParams.has('oauthCode')) {
    if (!localStorage.oauthState || url.searchParams.get('nonce') !== new URL(localStorage.oauthState).searchParams.get('nonce')) {
        console.error('oauth state mismatch');
        url.searchParams.delete('oauthCode');
        url.searchParams.delete('nonce');
        history.replaceState(null, '', url.href);
    } else {
        const getTokens = fetch(`${apiPrefix}/google-login?code=${encodeURIComponent(url.searchParams.get('oauthCode'))}&redirect_uri=${encodeURIComponent(fullRedirectUri)}`, {
            method: 'POST',
            headers: { 'X-Requested-With': 'fetch', },
        }).then(response => response.json());
        url.searchParams.delete('oauthCode');
        url.searchParams.delete('nonce');
        history.replaceState(null, '', url.href);
        const {access_token, refresh_token} = await getTokens;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
    }
}

const modalLogoutDialog = document.createElement('dialog');
modalLogoutDialog.classList.add('cloudSaveSyncDialog');
modalLogoutDialog.innerHTML = `
<h1 id="cloudSaveSyncDialogTitle">Log out?</h1>
<p id="cloudSaveSyncDialogMessage">Save files will remain on this device and in Google Drive, but sync will stop. Save file data in Google Drive can be deleted from Google Drive settings.</p>
<form method="dialog"><button id="cloudSaveSyncDialogActionButton">Log out</button> <button autoFocus id="cloudSaveSyncDialogCancelButton" value="cancel">Cancel</button></form>
`;
document.body.appendChild(modalLogoutDialog)

let style = document.createElement('style');
style.innerHTML = `
    .cloudSaveSyncDialog {
        border-radius: 2rem;
        padding: 2rem;
        max-width: 600px;
        box-shadow: 1rem 1rem 2rem 1rem rgba(0, 0, 0, .8);
    }
    .cloudSaveSyncDialog h1 {
        margin-top: 0;
    }
    .cloudSaveSyncDialog button {
        border-radius: .5rem;
        padding: 2rem;
        margin-right: 2rem;
        margin-top: 1rem;
        font-size: 2rem;
        border-width: .3rem;
    }
    .cloudSaveSyncDialog::backdrop {
        backdrop-filter: blur(.5rem);
    }
    `;
    
document.head.appendChild(style);

// Start login process by redirecting to Google OAuth login page

const redirectToGoogleLogin = () => {
    let stateUrl = new URL(location.href);
    stateUrl.searchParams.set('nonce', crypto.randomUUID());
    localStorage.oauthState = stateUrl.href;
//
// Here you can create your own oauth client ID at https://console.cloud.google.com
// Add you website with /oauth to redirect_uri (e.g. http://cave-story-web.pages.dev/oauth or http://localhost:8080/oauth )
// Then edit fllowing line with your info: client_id=nnnnnnnnnnnn-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
//
    window.location = `https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A//www.googleapis.com/auth/drive.appdata&access_type=offline&include_granted_scopes=true&response_type=code&state=${encodeURIComponent(stateUrl.href)}&redirect_uri=${encodeURIComponent(fullRedirectUri)}&client_id=764715416098-r0q3g7mcca2rkdnieh4s1o99rvi7sa74.apps.googleusercontent.com&prompt=select_account+consent`;
};

const showModal = async ({title, message, action, cancel}) => {
    if (!cancel) cancel = 'Cancel';
    if (!action) action = 'OK';
    if (!title) throw 'title required';
    if (!message) throw 'message required';
    modalLogoutDialog.querySelector('#cloudSaveSyncDialogTitle').textContent = title;
    modalLogoutDialog.querySelector('#cloudSaveSyncDialogMessage').textContent = message;
    modalLogoutDialog.querySelector('#cloudSaveSyncDialogActionButton').textContent = action;
    modalLogoutDialog.querySelector('#cloudSaveSyncDialogCancelButton').textContent = cancel;
    modalLogoutDialog.showModal();
    return new Promise((resolve) => {
        modalLogoutDialog.addEventListener('close', () => {
            resolve(modalLogoutDialog.returnValue !== 'cancel');
        });
    });
};

const confirmLogout = async() => {
    if (await showModal({title: 'Log out?', message: 'Save files will remain on this device and in Google Drive, but sync will stop. Save file data in Google Drive can be deleted from Google Drive settings.', action: 'Log out', cancel: 'Cancel'})) {
        // This actually revokes access to Drive for other computers where this user is logged in. Don't want that.
        // Although it may be necessary in some cases if Google refuses to return refresh tokens? Not sure the conditions under which that happens.
        // fetch(`https://oauth2.googleapis.com/revoke?token=${localStorage.access_token}`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/x-www-form-urlencoded', },
        // }).finally(()=>{{
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            location.reload()
        // }});
    }
};

let loginButtonElement;
let loginButtonInvisibleTimeout;

export const loginButton = (element, persist) => {
    loginButtonElement = element;
    const loggedIn = localStorage.access_token && localStorage.refresh_token;
    element.addEventListener('click', loggedIn ? confirmLogout : redirectToGoogleLogin);
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.margin = '1rem';
    if (!persist) {
        element.style.transition = 'opacity 0.5s';
        clearTimeout(loginButtonInvisibleTimeout);
        loginButtonInvisibleTimeout = setTimeout(() => {
            element.style.opacity = '0';
            loginButtonInvisibleTimeout = setTimeout(() => {
                element.style.visibility = 'hidden'
            }, 500);
        }, loggedIn ? 5500 : 10500);
    }
    const buttonText = loggedIn ? 'Save files are synced in Google Drive &nbsp;✅&nbsp;' : 'Login to sync save files with Google Drive';
    element.innerHTML = `<button class="gsi-material-button" id="loginButtonRoot" style="
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-appearance: none;
  background-color: WHITE;
  background-image: none;
  border: 1px solid #747775;
  -webkit-border-radius: 20px;
  border-radius: 20px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  color: #1f1f1f;
  cursor: pointer;
  font-family: 'Roboto', arial, sans-serif;
  font-size: 14px;
  height: 40px;
  letter-spacing: 0.25px;
  outline: none;
  overflow: hidden;
  padding: 0 12px;
  position: relative;
  text-align: center;
  -webkit-transition: background-color .218s, border-color .218s, box-shadow .218s;
  transition: background-color .218s, border-color .218s, box-shadow .218s;
  vertical-align: middle;
  white-space: nowrap;
  width: auto;
  max-width: 400px;
  min-width: min-content;">
  <div class="gsi-material-button-state" style="-webkit-transition: opacity .218s;
  transition: opacity .218s;
  bottom: 0;
  left: 0;
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;"></div>
  <div class="gsi-material-button-content-wrapper" style="  -webkit-align-items: center;
  align-items: center;
  display: flex;
  -webkit-flex-direction: row;
  flex-direction: row;
  -webkit-flex-wrap: nowrap;
  flex-wrap: nowrap;
  height: 100%;
  justify-content: space-between;
  position: relative;
  width: 100%;">
    <div class="gsi-material-button-icon" style="  height: 20px;
    margin-right: 12px;
    min-width: 20px;
    width: 20px;">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: block;">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
        <path fill="none" d="M0 0h48v48H0z"></path>
      </svg>
    </div>
    <span class="gsi-material-button-contents" id="loginButtonText" style="-webkit-flex-grow: 1;
    flex-grow: 1;
    font-family: 'Roboto', arial, sans-serif;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;">${buttonText}</span>
    <span style="display: none;" id="loginButtonTextHidden">${buttonText}</span>
  </div>
</button>`;
}

let customButtonHandler = null;

const setButtonText = (text, {makeRed, handler, delay}) => {
    if (!loginButtonElement) {
        console.error('tried to show message but loginButtonElement not set: ', text);
        return;
    }
    document.getElementById('loginButtonText').textContent = text;
    document.getElementById('loginButtonTextHidden').textContent = text;
    const root = document.getElementById('loginButtonRoot');
    if (makeRed) {
        root.style.color = 'white';
        root.style.backgroundColor = 'red';
    } else {
        root.style.color = '#1f1f1f';
        root.style.backgroundColor = 'white';
    }
    clearTimeout(loginButtonInvisibleTimeout);
    loginButtonElement.style.visibility = 'visible';
    loginButtonElement.style.opacity = '1';
    if (delay > 0) {
        loginButtonInvisibleTimeout = setTimeout(()=>{{
            loginButtonElement.style.opacity = '0';
            loginButtonInvisibleTimeout = setTimeout(()=>loginButtonElement.style.visibility = 'hidden', 500)
        }}, delay * 1000);
    }
    if (handler) {
        loginButtonElement.removeEventListener('click', redirectToGoogleLogin);
        loginButtonElement.removeEventListener('click', confirmLogout);
        loginButtonElement.removeEventListener('click', customButtonHandler);
        loginButtonElement.addEventListener('click', handler);
        customButtonHandler = handler;
    } else {
        loginButtonElement.removeEventListener('click', customButtonHandler);
        customButtonHandler = null;
        loginButtonElement.addEventListener('click', redirectToGoogleLogin);
        loginButtonElement.removeEventListener('click', confirmLogout);
    }
};

// Handle fetching a Google API URL, automatically refreshing the access token if needed

class AuthError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'AuthError';
    }
}

const authenticatedFetch = async (url, options, nested) => {
    const access_token = localStorage.access_token;
    if (!access_token) throw 'No access token';
    if (!options) options = {};
    if (!options.headers) options.headers = {};
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${access_token}`,
        },
    });
    if (response.status === 401) {
        if (nested) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setButtonText('Login expired. Save sync disabled. Click to fix.', { makeRed: true, handler: redirectToGoogleLogin })
            throw new AuthError('Failed authentication after refreshing access token');
        }
        const refresh_token = localStorage.refresh_token;
        if (!refresh_token) throw 'No refresh token';
        const refreshResponse = await fetch(`${apiPrefix}/oauth-refresh?refresh_token=${encodeURIComponent(refresh_token)}`, {
            method: 'POST',
            headers: { 'X-Requested-With': 'fetch', },
        });
        if (!refreshResponse.ok) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setButtonText('Login expired. Save sync disabled. Click to fix.', { makeRed: true, handler: redirectToGoogleLogin })
            throw new AuthError('Failed to refresh access token');
        }
        let {access_token} = await refreshResponse.json();
        localStorage.setItem('access_token', access_token);
        return authenticatedFetch(url, options, true);
    }
    return response;
};

// accepts modulePromise instead of the emscripten module directly, so that the first Google Drive call can be made in parallel with Emscripten module loading.
// Performs a cloud save sync before initial load if logged in. After this is complete, returns a function that should be called after the emscripten app modifies its save files, to save the changes to indexeddb and then (if logged in) sync with Google Drive.

export const mount = async(modulePromise, mountPoint) => {

    let startPlaytime = parseFloat(localStorage.getItem(`playtime:${mountPoint}`) || '0') || 0;
    let playtimeOffset = 0;
    let focused = document.hasFocus();
    let lastFocusedTime = performance.now();
    let committedInactiveTime = 0;

    function playtime() {
        let pt = startPlaytime;
        pt += performance.now() - playtimeOffset;
        pt -= inactiveTime();
        return pt;
    }
    window.addEventListener('focus', ()=>{{
        if (!focused) {
            console.log('focused @ ', playtime());
            focused = true;
            committedInactiveTime += performance.now() - lastFocusedTime;
        }
    }});
    window.addEventListener('blur', ()=>{{
        if (focused) {
            focused = false;
            lastFocusedTime = performance.now();
            console.log('blur @ ', playtime());
        }
    }});
    function inactiveTime() {
        return committedInactiveTime + (focused ? 0 : performance.now() - lastFocusedTime);
    }

    let firstSync = true;
    const cloudSync = async () => {
        if (!localStorage.access_token || !localStorage.refresh_token) {
            console.warn('Not logged in, skipping cloud save sync');
            return false;
        }
        const fileListResponse = authenticatedFetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${mountPoint}'&spaces=appDataFolder&fields=files(id,name,modifiedTime,size,appProperties)`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', },
            signal: AbortSignal.timeout(5000),
        }).then(async (r) => {
            const json = await r.json();
            if (json.nextPageToken) {
                console.error('Pagination unimplemented, Google Drive sync incomplete');
            }
            return json;
        });
        const db = await new Promise(async (resolve, reject)=>{{
            (await modulePromise).IDBFS.getDB(mountPoint, (err, db) => {
                if (err) reject(err);
                else resolve(db);
            });
        }});

        let localPlaytime = playtime();
        const allFiles = {};
        await new Promise((resolve, reject) => {
            let transaction = db.transaction('FILE_DATA').objectStore('FILE_DATA').openCursor();
            transaction.onsuccess = event => {
                let cursor = event.target.result;
                if (cursor) {
                    cursor.value.sha256 = crypto.subtle.digest('SHA-256', cursor.value.contents).then(hashBuffer => {
                        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                    });
                    cursor.value.name = cursor.primaryKey;
                    console.log(`local file:`, cursor.primaryKey, cursor.value);
                    allFiles[cursor.primaryKey] = {local: cursor.value};
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            transaction.onerror = e=>reject(e);
        });
        let remoteFileList;
        try {
            if (!navigator.onLine) throw 'offline';
            remoteFileList = await fileListResponse;
        } catch (e) {
            console.error('google drive list files got error: ', e);
            if (e instanceof AuthError) return false; // Error message is already displayed
            setButtonText('Network error. Sync paused. Progress saved locally. Reload to retry sync.', { delay: 10, handler: confirmLogout });
            return false;
        }
        let remotePlaytime = 0;
        for (let file of remoteFileList.files) {
            file.modifiedTime = new Date(file.modifiedTime);
            const playtime = parseFloat(file.appProperties.playtime);
            if (playtime > remotePlaytime) remotePlaytime = playtime;
            allFiles[file.name] = allFiles[file.name] || {};
            allFiles[file.name].remote = file;
            console.log('remote file: ', file);
        }
        for (let {local} of Object.values(allFiles)) if (local) local.sha256 = await local.sha256;
        let uploadedAnyFile = false;
        const uploadFile = async (local, remote) => {
            uploadedAnyFile = true;
            console.log(`uploading ${local.name}`);
            let method = 'POST';
            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
            if (remote) {
                method = 'PATCH';
                url = `https://www.googleapis.com/upload/drive/v3/files/${remote.id}?uploadType=resumable`;
            }
            let body = {
                name: local.name,
                mimeType: 'application/octet-stream',
                appProperties: {
                    mode: local.mode,
                    sha256: local.sha256,
                    playtime: localPlaytime.toString(),
                },
                modifiedTime: local.timestamp,
            };
            if (!remote) body.parents = ['appDataFolder'];
            const response = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(body),
            });
            let location = response.headers.get('Location');
            await (await authenticatedFetch(location, {
                method: remote ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': local.contents.byteLength,
                },
                body: local.contents,
            })).text();
        };
        let downloadedAnyFile = false;
        const downloadFile = async (remote) => {
            downloadedAnyFile = true;
            console.log(`downloading ${remote.name}`);
            let fileResponse = await authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${remote.id}?alt=media`);
            if (!fileResponse.ok) {
                throw `Failed to fetch the file: ${fileResponse.status} ${fileResponse.statusText} ${await fileResponse.text()}`;
            } else {
                let fileContent = await fileResponse.arrayBuffer();
                console.log('File content:', fileContent);
                let transaction = db.transaction('FILE_DATA', 'readwrite');
                transaction.objectStore('FILE_DATA').put({timestamp: new Date(remote.modifiedTime), contents: new Uint8Array(fileContent), mode: remote.appProperties.mode}, remote.name);
                await new Promise((resolve, reject) => {
                    transaction.oncomplete = resolve;
                    transaction.onerror = reject;
                });
            }
        };
        const fetchPromises = [];
        for (let [name, { local, remote }] of Object.entries(allFiles)) {
            if (local && remote) {
                if (local.sha256 === remote.appProperties.sha256) {
                    console.log(`${name}: local and remote contents are the same`);
                } else {
                    console.log(`hashes don't match for ${name}, local:`, local.sha256, 'remote:', remote.appProperties.sha256);
                    console.log('local: ', local, 'remote: ', remote);
                    console.log('localPlaytime: ', localPlaytime, 'remotePlaytime: ', remotePlaytime);
                    if (localPlaytime < remotePlaytime) {
                        console.log(`remote file is newer, downloading ${name}`);
                        fetchPromises.push(downloadFile(remote));
                    } else {
                        console.log(`local file is newer, uploading ${name}`);
                        fetchPromises.push(uploadFile(local, remote));
                    }
                }
            } else if (local) {
                if (localPlaytime < remotePlaytime) {
                    console.log(`file only present locally, deleting ${name} from local`);
                    fetchPromises.push(new Promise((resolve, reject)=>{{
                        const op = db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').delete(local.name);
                        op.onsuccess = resolve;
                        op.onerror = reject;
                    }}));
                } else {
                    console.log(`file only present locally, uploading ${name}`);
                    fetchPromises.push(uploadFile(local));
                }
            } else if (remote) {
                if (localPlaytime < remotePlaytime) {
                    console.log(`file only present on remote, downloading ${name}`);
                    fetchPromises.push(downloadFile(remote));
                } else {
                    console.log(`only present on remote, file was deleted locally, delete remote copy too`);
                    fetchPromises.push(authenticatedFetch(`https://www.googleapis.com/drive/v3/files/${remote.id}`, { method: 'DELETE' }))
                }
            } else {
                console.error(`file ${name} is missing both locally and remotely, this should not happen`);
            }
        }
        await Promise.all(fetchPromises);
        console.log('cloud save sync complete!');
        if (remotePlaytime > localPlaytime) {
            localStorage.setItem(`playtime:${mountPoint}`, remotePlaytime);
            startPlaytime = remotePlaytime;
            committedInactiveTime = 0;
            lastFocusedTime = performance.now();
            playtimeOffset = performance.now();
        }
        if (downloadedAnyFile && !firstSync) {
            // If we updated any files after the game started we need to reload the game to make sure the new save files are loaded.
            // Potentially disruptive? yes. But prompting the user to decide what to do is unlikely to be better, the user doesn't have the information to make a good decision and they wouldn't read it if we showed it to them.
            // The idea is that this will only happen if the cloud save files have more accumulated playtime than the local save files, so it's OK to discard local progress.
            // If this is ever changed, make sure the playtime calculation still works properly after a sync.
            location.reload();
        }
        firstSync = false;
        return downloadedAnyFile;
    };
    await cloudSync();
    const module = await modulePromise;
    module.FS.mkdirTree(mountPoint);
    module.FS.mount(module.FS.filesystems.IDBFS, {}, mountPoint);
    let idbfsReadyResolve = null;
    const idbfsReady = new Promise(r=>idbfsReadyResolve=r);
    module.FS.syncfs(true, (err) => {
        if (err) { console.error(err); debugger; }
        idbfsReadyResolve();
    });
    await idbfsReady;

    let lastSaveTime = 0;
    async function save() {
        lastSaveTime = performance.now();
        return new Promise((resolve, reject) => {
            setTimeout(()=>{{
                module.FS.syncfs(false, (err) => {
                    if (err) { console.error(err); debugger; reject(); return; }
                    localStorage.setItem(`playtime:${mountPoint}`, playtime());
                    resolve(cloudSync());
                });
            }}, 50);
        });
    };

    window.addEventListener('focus', () => {
        if (performance.now() - lastSaveTime > 60*1000) save();
    });
    return save;
};

