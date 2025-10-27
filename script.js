const video = document.getElementById('video');
const captureButton = document.getElementById('capture');
const downloadLink = document.getElementById('download');
const hideBtn = document.getElementById('hide');
// Create countdown display
const countdownDisplay = document.createElement('div');
document.querySelector('.glass-ui').appendChild(countdownDisplay); // Append once

// Style the countdown
Object.assign(countdownDisplay.style, {
    position: 'absolute',
    top: '10%',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    fontSize: '28px',
    fontWeight: 'bold',
    background: 'rgba(0,0,0,0.5)',
    padding: '10px 20px',
    borderRadius: '12px',
    backdropFilter: 'blur(5px)',
    display: 'none',
    zIndex: '10'
});

// Modal elements
const previewModal = document.getElementById('preview-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalCanvas = document.getElementById('modal-canvas');
const modalDownload = document.getElementById('modal-download');
const modalRetake = document.getElementById('modal-retake');

// Helper: Show modal
function showModal() {
    previewModal.style.display = 'flex';
    closeModalBtn.focus();
    document.body.style.overflow = 'hidden';
}
// Helper: Hide modal
function hideModal() {
    previewModal.style.display = 'none';
    document.body.style.overflow = '';
}
// Accessibility: Close modal on ESC
window.addEventListener('keydown', (e) => {
    if (previewModal.style.display === 'flex' && (e.key === 'Escape' || e.key === 'Esc')) {
        hideModal();
    }
});
closeModalBtn.addEventListener('click', hideModal);
closeModalBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') hideModal();
});

const instructionsSection = document.querySelector('.instructions');
let cameraAccessGranted = false;

function setInstructions(status) {
    if (status === 'allowed') {
        instructionsSection.classList.add('hidden');
    } else if (status === 'denied') {
        instructionsSection.classList.remove('hidden');
        instructionsSection.innerHTML = `
            <h1>Camera Access Needed</h1>
            <p style="color:#F87171;">Camera access was denied.<br>
            Please enable camera access in your browser settings and reload the page.</p>
            <button id="retry-camera" class="modern-btn">Retry Camera Access</button>
        `;
        document.getElementById('retry-camera').addEventListener('click', requestCameraAccess);
    } else {
        instructionsSection.classList.remove('hidden');
        instructionsSection.innerHTML = `
            <h1>Take Your Photo Strip!</h1>
            <p>1. Allow camera access.<br>
               2. Click <b>Capture</b> to take 3 photos.<br>
               3. Preview your photo strip.<br>
               4. Download or retake as you like!</p>
        `;
    }
}

function requestCameraAccess() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            cameraAccessGranted = true;
            localStorage.setItem('photobooth_camera_access', 'allowed');
            setInstructions('allowed');
        })
        .catch(error => {
            cameraAccessGranted = false;
            localStorage.setItem('photobooth_camera_access', 'denied');
            setInstructions('denied');
            console.error('Error accessing webcam:', error);
        });
}

// On page load, check camera access choice
const storedAccess = localStorage.getItem('photobooth_camera_access');
if (storedAccess === 'allowed') {
    setInstructions('allowed');
    requestCameraAccess();
} else if (storedAccess === 'denied') {
    setInstructions('denied');
} else {
    setInstructions();
    requestCameraAccess();
}

// Capture a single frame from video
function captureFrame() {
    const tempCanvas = document.createElement('canvas');
    const tempContext = tempCanvas.getContext('2d');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    tempContext.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas;
}

// Countdown logic
function showCountdown(number) {
    countdownDisplay.style.display = 'block';
    countdownDisplay.textContent = number;
    captureButton.innerText='capturing....'

    // Restart animation
    countdownDisplay.style.animation = 'none';
    countdownDisplay.offsetHeight; // Trigger reflow
    countdownDisplay.style.animation = 'pulse 1s ease';
}

function clearCountdown() {
    countdownDisplay.textContent = '';
    countdownDisplay.style.display = 'none';
}

// Store the latest photo strip image data
let latestPhotoStripDataUrl = null;

// Instead, use an off-screen canvas for photo strip composition
function drawFrames(frames) {
    const paddingTop = 40;   // px
    const paddingSides = 40; // px

    const width = frames[0].width;
    const height = frames[0].height;
    const spacing = 10;
    const dateGap = 30;
    const textHeight = 30;
    const totalHeight = (height * frames.length) + (spacing * (frames.length - 1)) + dateGap + textHeight;

    // Increase canvas size for padding
    const canvasWidth = width + paddingSides * 2;
    const canvasHeight = totalHeight + paddingTop;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvasWidth;
    offCanvas.height = canvasHeight;
    const offCtx = offCanvas.getContext('2d');

    // Fill with white
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

    // Draw each frame with offset for padding
    frames.forEach((frame, index) => {
        const yOffset = index * (height + spacing) + paddingTop;
        offCtx.drawImage(frame, paddingSides, yOffset);
    });

    // Draw the date at the bottom, also offset
    offCtx.fillStyle = '#000';
    offCtx.font = '30px "Chakra Petch", sans-serif';
    offCtx.textAlign = 'center';
    offCtx.fillText(date(), offCanvas.width / 2, offCanvas.height - 10);

    return offCanvas;
}

// Update capture flow to use off-screen canvas and modal only
const cameraSound = new Audio('./iphone-camera-capture.mp3');
captureButton.addEventListener('click', () => {
    const totalPhotos = 3;
    const delay = 1000;
    const frames = [];
    let count = 0;

    const countdownAndCapture = () => {
        if (count < totalPhotos) {
            let countdown = 3;
            showCountdown(countdown);
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    showCountdown(countdown);
                } else {
                    clearInterval(countdownInterval);
                    captureButton.innerText = 'capture';
                    clearCountdown();
                    const frame = captureFrame();
                    cameraSound.currentTime = 0;
                    cameraSound.play();
                    frames.push(frame);
                    count++;
                    setTimeout(countdownAndCapture, delay);
                }
            }, 1000);
        } else {
            // Compose the photo strip using off-screen canvas
            const stripCanvas = drawFrames(frames);
            // Draw to modal canvas
            modalCanvas.width = stripCanvas.width;
            modalCanvas.height = stripCanvas.height;
            const ctx = modalCanvas.getContext('2d');
            ctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
            ctx.drawImage(stripCanvas, 0, 0);
            // Set download link
            const image = stripCanvas.toDataURL('image/png');
            modalDownload.href = image;
            modalDownload.download = 'photo_strip(by Wazir).png';
            // Store latest photo strip
            latestPhotoStripDataUrl = image;
            // Show modal
            showModal();
            downloadLink.style.display = 'none';
            captureButton.innerText = '\u21bb Retake';
            hideBtn.innerText = 'Hide';
        }
    };
    countdownAndCapture();
});

// Show button opens modal with latest photo strip
hideBtn.addEventListener('click', () => {
    if (latestPhotoStripDataUrl) {
        // Draw the latest photo strip to the modal canvas
        const img = new window.Image();
        img.onload = function() {
            modalCanvas.width = img.width;
            modalCanvas.height = img.height;
            const ctx = modalCanvas.getContext('2d');
            ctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = latestPhotoStripDataUrl;
        modalDownload.href = latestPhotoStripDataUrl;
        modalDownload.download = 'photo_strip(by Wazir).png';
        showModal();
    } else {
        alert('No photo strip available yet! Please capture photos first.');
    }
});

// Modal retake button
if (modalRetake) {
    modalRetake.addEventListener('click', () => {
        hideModal();
        // No need to clear any canvas in the DOM
        captureButton.innerText = '\ud83d\udcf8 Capture';
    });
}

// Accessibility: trap focus in modal
previewModal.addEventListener('keydown', (e) => {
    if (previewModal.style.display !== 'flex') return;
    const focusable = previewModal.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
});

//To add Date on the strip
function date() {
    const date_now = new Date();
    const format_date_now = date_now.toString().split('G')[0]
    return format_date_now
}
