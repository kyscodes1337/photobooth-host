document.addEventListener('DOMContentLoaded', function() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const handCanvas = document.getElementById('handCanvas');
  const handCtx = handCanvas.getContext('2d');
  const handText = document.getElementById('handText');
  const startCameraBtn = document.getElementById('startCamera');
  const takePhotoBtn = document.getElementById('takePhoto');
  const downloadPhotoBtn = document.getElementById('downloadPhoto');
  const clearPhotosBtn = document.getElementById('clearPhotos');
  const gallery = document.getElementById('gallery');
  const flash = document.getElementById('flash');
  const modal = document.getElementById('modal');
  const modalImage = document.getElementById('modal-image');
  const closeModal = document.querySelector('.modal-close');
  const downloadFromModal = document.getElementById('downloadFromModal');
  const deleteFromModal = document.getElementById('deleteFromModal');
  const switchCameraBtn = document.getElementById('switchCamera');
  const photoCount = document.getElementById('photoCount');
  const emptyGallery = document.querySelector('.empty-gallery');
  
  let stream = null;
  let currentFilter = 'none';
  let photos = JSON.parse(localStorage.getItem('photoboothPhotos')) || [];
  let currentPhotoIndex = -1;
  let facingMode = "user";
  let handposeModel = null;
  let handDetectionActive = false;
  let lastHandDetectionTime = 0;
  
  updatePhotoCount();
  renderGallery();
  
  startCameraBtn.addEventListener('click', startCamera);
  takePhotoBtn.addEventListener('click', takePhoto);
  downloadPhotoBtn.addEventListener('click', downloadPhoto);
  clearPhotosBtn.addEventListener('click', clearPhotos);
  closeModal.addEventListener('click', closeModalFunc);
  downloadFromModal.addEventListener('click', downloadCurrentPhoto);
  deleteFromModal.addEventListener('click', deleteCurrentPhoto);
  switchCameraBtn.addEventListener('click', switchCamera);
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function() {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentFilter = this.dataset.filter;
          applyFilter();
      });
  });
  
  // Functions
  async function startCamera() {
      try {
          startCameraBtn.innerHTML = '<div class="spinner"></div> Starting...';
          startCameraBtn.disabled = true;
          
          stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: facingMode
              }, 
              audio: false 
          });
          
          video.srcObject = stream;
          startCameraBtn.style.display = 'none';
          takePhotoBtn.disabled = false;
          switchCameraBtn.style.display = 'flex';
          
          video.addEventListener('loadedmetadata', () => {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              handCanvas.width = video.videoWidth;
              handCanvas.height = video.videoHeight;
              
              loadHandposeModel();
          });
      } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Could not access the camera. Please make sure you've granted camera permissions.");
          startCameraBtn.innerHTML = '<i class="fas fa-camera"></i> Start Camera';
          startCameraBtn.disabled = false;
      }
  }
  
  async function loadHandposeModel() {
      try {
          handposeModel = await handpose.load();
          console.log("Handpose model loaded");
          handDetectionActive = true;
          
          detectHands();
      } catch (err) {
          console.error("Error loading handpose model:", err);
          handDetectionActive = false;
      }
  }
  
  async function detectHands() {
      if (!handDetectionActive || !handposeModel) return;
      
      try {
          const predictions = await handposeModel.estimateHands(video);
          
          handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
          
          if (predictions.length > 0) {
              drawHand(predictions);
              
              handText.classList.add('show');
              lastHandDetectionTime = Date.now();
          } else {
              if (Date.now() - lastHandDetectionTime > 1000) {
                  handText.classList.remove('show');
              }
          }
      } catch (err) {
          console.error("Error detecting hands:", err);
      }
      
      requestAnimationFrame(detectHands);
  }
  
  function drawHand(predictions) {
      for (let i = 0; i < predictions.length; i++) {
          const landmarks = predictions[i].landmarks;

          handCtx.strokeStyle = 'var(--hand-color)';
          handCtx.lineWidth = 2;
          
          handCtx.fillStyle = 'var(--hand-color)';
          for (let j = 0; j < landmarks.length; j++) {
              const [x, y] = landmarks[j];
              
              handCtx.beginPath();
              handCtx.arc(x, y, 4, 0, 2 * Math.PI);
              handCtx.fill();
          }
          
          const connections = [
              [0, 1, 2, 3, 4],
              [0, 5, 6, 7, 8],
              [0, 9, 10, 11, 12],
              [0, 13, 14, 15, 16],
              [0, 17, 18, 19, 20],
          ];
          
          for (let c = 0; c < connections.length; c++) {
              const finger = connections[c];
              handCtx.beginPath();
              
              for (let f = 0; f < finger.length; f++) {
                  const [x, y] = landmarks[finger[f]];
                  if (f === 0) {
                      handCtx.moveTo(x, y);
                  } else {
                      handCtx.lineTo(x, y);
                  }
              }
              
              handCtx.stroke();
          }
          
          const palmConnections = [
              [1, 5], [5, 9], [9, 13], [13, 17], [17, 1]
          ];
          
          for (let p = 0; p < palmConnections.length; p++) {
              const [start, end] = palmConnections[p];
              const [x1, y1] = landmarks[start];
              const [x2, y2] = landmarks[end];
              
              handCtx.beginPath();
              handCtx.moveTo(x1, y1);
              handCtx.lineTo(x2, y2);
              handCtx.stroke();
          }
      }
  }
  
  async function switchCamera() {
      if (!stream) return;
      
      stream.getTracks().forEach(track => track.stop());
      
      facingMode = facingMode === "user" ? "environment" : "user";
      
      await startCamera();
  }
  
  function takePhoto() {
      flash.classList.add('flash-animation');
      setTimeout(() => flash.classList.remove('flash-animation'), 500);
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      applyFilter();
      
      if (handText.classList.contains('show')) {
          const text = "HALLO";
          context.font = "bold 80px Arial";
          context.fillStyle = "var(--hand-color)";
          context.textAlign = "center";
          context.shadowColor = "rgba(0, 206, 201, 0.7)";
          context.shadowBlur = 10;
          context.fillText(text, canvas.width / 2, 100);
          context.shadowBlur = 0;
      }
      
      const photoData = canvas.toDataURL('image/jpeg', 0.9);
      photos.unshift(photoData);
      savePhotos();
      renderGallery();

      downloadPhotoBtn.disabled = false;
  }
  
  function applyFilter() {
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      context.filter = 'none';
      
      switch(currentFilter) {
          case 'grayscale':
              context.filter = 'grayscale(100%)';
              break;
          case 'sepia':
              context.filter = 'sepia(80%)';
              break;
          case 'invert':
              context.filter = 'invert(100%)';
              break;
          case 'blur':
              context.filter = 'blur(4px)';
              break;
          case 'hue':
              context.filter = 'hue-rotate(90deg)';
              break;
          case 'vintage':
              context.filter = 'contrast(1.1) brightness(1.1) sepia(0.3) saturate(1.5)';
              break;
          case 'none':
          default:
              context.filter = 'none';
      }
      
      context.drawImage(canvas, 0, 0);
      context.filter = 'none';
  }
  
  function downloadPhoto() {
      downloadImage(canvas.toDataURL('image/jpeg', 0.9));
  }
  
  function downloadCurrentPhoto() {
      if (currentPhotoIndex >= 0) {
          downloadImage(photos[currentPhotoIndex]);
      }
      closeModalFunc();
  }
  
  function downloadImage(dataUrl) {
      const link = document.createElement('a');
      link.download = 'photobooth-' + new Date().toISOString().slice(0, 10) + '.jpg';
      link.href = dataUrl;
      link.click();
  }
  
  function renderGallery() {
      if (photos.length === 0) {
          gallery.innerHTML = `
              <div class="empty-gallery">
                  <i class="fas fa-images" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                  <p>No photos yet. Start capturing memories!</p>
              </div>
          `;
          return;
      }
      
      gallery.innerHTML = '';
      photos.forEach((photo, index) => {
          const photoItem = document.createElement('div');
          photoItem.className = 'photo-item';
          photoItem.innerHTML = `
              <img src="${photo}" alt="Photo ${index + 1}">
              <button class="delete-btn" data-index="${index}">
                  <i class="fas fa-times"></i>
              </button>
          `;
          
          photoItem.addEventListener('click', (e) => {
              if (e.target.closest('.delete-btn')) return;
              
              currentPhotoIndex = index;
              modalImage.src = photo;
              modal.classList.add('show');
          });
          
          const deleteBtn = photoItem.querySelector('.delete-btn');
          deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              deletePhoto(index);
          });
          
          gallery.appendChild(photoItem);
      });
      
      updatePhotoCount();
  }
  
  function deletePhoto(index) {
      if (confirm('Are you sure you want to delete this photo?')) {
          photos.splice(index, 1);
          savePhotos();
          renderGallery();
          
          if (photos.length === 0) {
              downloadPhotoBtn.disabled = true;
          }
      }
  }
  
  function deleteCurrentPhoto() {
      if (currentPhotoIndex >= 0) {
          deletePhoto(currentPhotoIndex);
          closeModalFunc();
      }
  }
  
  function savePhotos() {
      localStorage.setItem('photoboothPhotos', JSON.stringify(photos));
      updatePhotoCount();
  }
  
  function updatePhotoCount() {
      const count = photos.length;
      photoCount.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
      
      if (count > 0) {
          emptyGallery?.remove();
      }
  }
  
  function clearPhotos() {
      if (photos.length === 0) return;
      
      if (confirm('Are you sure you want to clear all photos? This cannot be undone.')) {
          photos = [];
          savePhotos();
          renderGallery();
          downloadPhotoBtn.disabled = true;
      }
  }
  
  function closeModalFunc() {
      modal.classList.remove('show');
      currentPhotoIndex = -1;
  }
  
  window.addEventListener('beforeunload', () => {
      if (stream) {
          stream.getTracks().forEach(track => track.stop());
      }
  });
});