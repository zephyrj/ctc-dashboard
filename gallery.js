class ImageGallery {
    constructor(img_url_data_list) {
        this.gallery = document.getElementById('gallery');
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImg = document.getElementById('lightbox-img');
        this.closeBtn = document.querySelector('.close');

        this.reload(img_url_data_list);
        try {
            this.setupLightbox();
        } catch (error) {
            this.showError('Failed to load images: ' + error.toString());
        }
    }

    reload(img_url_data_list ) {
        try {
            this.renderGallery(img_url_data_list);
        } catch (error) {
            this.showError('Failed to load images: ' + error.toString());
        }
    }

    renderGallery(images) {
        this.gallery.innerHTML = '';

        images.forEach(image => {
            const galleryItem = this.createGalleryItem(image);
            this.gallery.appendChild(galleryItem);
        });
    }

    createGalleryItem(image) {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        item.innerHTML = `
                    <img src="${image.thumb_url}" alt="${image.thumb_url}" loading="lazy">
                `;

        item.addEventListener('click', () => {
            this.openLightbox(image.full_url, image.full_url);
        });

        return item;
    }

    setupLightbox() {
        this.closeBtn.addEventListener('click', () => {
            this.closeLightbox();
        });

        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) {
                this.closeLightbox();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox();
            }
        });
    }

    openLightbox(src, alt) {
        this.lightboxImg.src = src;
        this.lightboxImg.alt = alt;
        this.lightbox.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeLightbox() {
        this.lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    showError(message) {
        this.gallery.innerHTML = `<div class="error">${message}</div>`;
    }
}
