document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const categorySection = document.querySelector('.home-categories');
  const categoryDialog = categorySection?.querySelector('.category-detail');
  const categoryDialogContent = categoryDialog?.querySelector('.category-detail__content');
  const categoryDialogClose = categoryDialog?.querySelector('.category-detail__close');
  if (categorySection && categoryDialog && categoryDialogContent && categoryDialogClose) {
    let activeCategoryButton = null;
    categorySection.querySelectorAll('.category-read-more').forEach((button) => {
      button.addEventListener('click', () => {
        const detailTemplate = categorySection.querySelector(`#${button.dataset.categoryDetail}`);
        if (!(detailTemplate instanceof HTMLTemplateElement)) return;

        categoryDialogContent.replaceChildren(detailTemplate.content.cloneNode(true));
        categoryDialogContent.querySelectorAll('.lang-en, .lang-si').forEach((node) => {
          node.hidden = !node.classList.contains(body.dataset.language === 'si' ? 'lang-si' : 'lang-en');
        });
        const title = categoryDialogContent.querySelector('h2');
        if (title) {
          title.id = 'category-detail-title';
          categoryDialog.setAttribute('aria-labelledby', title.id);
        }
        activeCategoryButton = button;
        categoryDialog.showModal();
        categoryDialogClose.focus();
      });
    });

    categoryDialogClose.addEventListener('click', () => categoryDialog.close());
    categoryDialog.addEventListener('click', (event) => {
      if (event.target === categoryDialog) categoryDialog.close();
    });
    categoryDialog.addEventListener('close', () => {
      activeCategoryButton?.focus();
      activeCategoryButton = null;
    });
  }

  const statisticCounters = Array.from(document.querySelectorAll('.stats-grid .stat strong'));
  const statisticTargets = [2026, 10, 11];
  if (
    statisticCounters.length === statisticTargets.length
    && statisticCounters.every((counter, index) => counter.textContent.trim() === String(statisticTargets[index]))
  ) {
    const statisticSection = statisticCounters[0].closest('.stats-grid');
    function isElementVisible(element) {
      const bounds = element.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < window.innerHeight;
    }

    let yearHasStarted = false;
    let categoriesHaveStarted = false;
    let hasScrolledDown = false;
    let sectionIsVisible = statisticSection ? isElementVisible(statisticSection) : false;
    let touchStartY = null;
    let yearObserver;
    let categoryObserver;

    statisticCounters.forEach((counter) => {
      counter.textContent = '1';
    });

    const animateCounters = (counterIndexes) => {
      const duration = 1000;
      const startTime = performance.now();
      const updateCounters = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;
        counterIndexes.forEach((index) => {
          const counter = statisticCounters[index];
          const target = statisticTargets[index];
          counter.textContent = String(
            progress === 1 ? target : Math.min(target, Math.floor(1 + (target - 1) * easedProgress))
          );
        });

        if (progress < 1) window.requestAnimationFrame(updateCounters);
      };

      window.requestAnimationFrame(updateCounters);
    };

    const startYearAnimation = () => {
      if (yearHasStarted) return;
      yearHasStarted = true;
      animateCounters([0]);
      yearObserver?.disconnect();
      window.removeEventListener('scroll', handleYearScroll);
    };

    const handleYearScroll = () => {
      if (isElementVisible(statisticCounters[0])) startYearAnimation();
    };

    const startCategoryAnimations = () => {
      if (!hasScrolledDown || !sectionIsVisible || categoriesHaveStarted) return;
      categoriesHaveStarted = true;
      animateCounters([1, 2]);
      categoryObserver?.disconnect();
      window.removeEventListener('scroll', handleCategoryScroll);
      window.removeEventListener('wheel', handleCategoryWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleCategoryKeyDown);
    };

    const handleCategoryScroll = () => {
      if (!categoryObserver && statisticSection) sectionIsVisible = isElementVisible(statisticSection);
      startCategoryAnimations();
    };

    const handleCategoryWheel = (event) => {
      if (event.deltaY <= 0) return;
      hasScrolledDown = true;
      if (!categoryObserver && statisticSection) sectionIsVisible = isElementVisible(statisticSection);
      startCategoryAnimations();
    };

    const handleTouchStart = (event) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event) => {
      const currentTouchY = event.touches[0]?.clientY;
      if (touchStartY !== null && currentTouchY !== undefined && currentTouchY < touchStartY) {
        hasScrolledDown = true;
        if (!categoryObserver && statisticSection) sectionIsVisible = isElementVisible(statisticSection);
        startCategoryAnimations();
      }
      touchStartY = currentTouchY ?? null;
    };

    const handleCategoryKeyDown = (event) => {
      if (!['ArrowDown', 'PageDown'].includes(event.key) && event.code !== 'Space') return;
      if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      hasScrolledDown = true;
      if (!categoryObserver && statisticSection) sectionIsVisible = isElementVisible(statisticSection);
      startCategoryAnimations();
    };

    if ('IntersectionObserver' in window) {
      yearObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.target === statisticCounters[0] && entry.isIntersecting)) {
          startYearAnimation();
        }
      });
      yearObserver.observe(statisticCounters[0]);

      if (statisticSection) {
        categoryObserver = new IntersectionObserver((entries) => {
          sectionIsVisible = entries.some((entry) => entry.isIntersecting);
          startCategoryAnimations();
        });
        categoryObserver.observe(statisticSection);
      }
    }

    window.addEventListener('scroll', handleYearScroll, { passive: true });
    window.addEventListener('scroll', handleCategoryScroll, { passive: true });
    window.addEventListener('wheel', handleCategoryWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleCategoryKeyDown);
    if (isElementVisible(statisticCounters[0])) startYearAnimation();
  }

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    const updateTopbarScrollState = () => {
      topbar.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    updateTopbarScrollState();
    window.addEventListener('scroll', updateTopbarScrollState, { passive: true });

    if (!document.querySelector('.device-notch')) {
      const notch = document.createElement('div');
      notch.className = 'device-notch';
      notch.setAttribute('aria-hidden', 'true');
      body.insertBefore(notch, topbar);
    }

    const lens = document.createElement('div');
    lens.className = 'topbar-lens';
    lens.setAttribute('aria-hidden', 'true');
    lens.inert = true;

    const scene = document.createElement('div');
    scene.className = 'topbar-lens__scene';
    lens.append(scene);
    topbar.insertBefore(lens, topbar.firstChild);

    const removeNonFlowContent = (source, mirror) => {
      const sourceChildren = Array.from(source.children);
      const mirrorChildren = Array.from(mirror.children);
      sourceChildren.forEach((sourceChild, index) => {
        const mirrorChild = mirrorChildren[index];
        if (!mirrorChild) return;

        const tagName = sourceChild.tagName;
        const position = getComputedStyle(sourceChild).position;
        if (
          sourceChild.classList.contains('topbar-lens')
          || sourceChild.matches('[data-logo-viewer], [data-careers-reservation], [data-careers-reserve], .image-viewer')
          || ['IFRAME', 'VIDEO', 'AUDIO', 'OBJECT', 'EMBED'].includes(tagName)
          || position === 'fixed'
          || position === 'sticky'
        ) {
          mirrorChild.remove();
          return;
        }

        removeNonFlowContent(sourceChild, mirrorChild);
      });
    };

    const refreshLensScene = () => {
      scene.replaceChildren();
      const bodyStyle = getComputedStyle(body);
      scene.style.background = bodyStyle.background;
      scene.style.color = bodyStyle.color;
      scene.style.direction = bodyStyle.direction;
      scene.style.font = bodyStyle.font;
      scene.style.lineHeight = bodyStyle.lineHeight;
      scene.dataset.language = body.dataset.language || 'en';

      Array.from(body.children).forEach((child) => {
        if (
          child === lens
          || child.classList.contains('device-notch')
          || child.matches('[data-logo-viewer], [data-careers-reservation], [data-careers-reserve], .image-viewer')
          || child.tagName === 'SCRIPT'
        ) return;

        const mirror = child.cloneNode(true);
        if (child === topbar) {
          mirror.classList.remove('is-scrolled');
          mirror.style.position = 'static';
          mirror.style.visibility = 'hidden';
          mirror.style.zIndex = 'auto';
        }
        removeNonFlowContent(child, mirror);
        scene.append(mirror);
      });

      updateLensGeometry();
    };

    const updateLensGeometry = () => {
      const bounds = topbar.getBoundingClientRect();
      const topbarStyle = getComputedStyle(topbar);
      const scrollY = window.scrollY;
      const scale = topbar.classList.contains('is-scrolled') ? 1.24 : 1.18;

      scene.style.width = `${window.innerWidth}px`;
      scene.style.height = `${Math.max(document.documentElement.scrollHeight, window.innerHeight)}px`;
      scene.style.left = `${-bounds.left - parseFloat(topbarStyle.borderLeftWidth)}px`;
      scene.style.top = `${-scrollY - bounds.top - parseFloat(topbarStyle.borderTopWidth)}px`;
      scene.style.transformOrigin = `${bounds.left + bounds.width / 2}px ${scrollY + bounds.top}px`;
      scene.style.transform = `scale(${scale})`;
    };

    let lensUpdateFrame = 0;
    let lensRefreshTimer = 0;
    const scheduleLensGeometryUpdate = () => {
      if (lensUpdateFrame) return;
      lensUpdateFrame = window.requestAnimationFrame(() => {
        lensUpdateFrame = 0;
        updateLensGeometry();
      });
    };
    const scheduleLensRefresh = () => {
      window.clearTimeout(lensRefreshTimer);
      lensRefreshTimer = window.setTimeout(refreshLensScene, 140);
    };

    window.addEventListener('scroll', scheduleLensGeometryUpdate, { passive: true });
    window.addEventListener('resize', scheduleLensRefresh, { passive: true });
    const handleLensContentChange = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-logo-viewer], [data-careers-reservation], [data-careers-reserve], .sub-company-card__logo, .image-viewer')) return;
      scheduleLensRefresh();
    };
    body.addEventListener('click', handleLensContentChange, true);
    body.addEventListener('input', handleLensContentChange, true);
    body.addEventListener('change', handleLensContentChange, true);
    refreshLensScene();
  }

  const homePhoto = document.querySelector('body > main .hero-visual img');
  if (homePhoto) {
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.hidden = true;
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'CEO profile photograph viewer');
    viewer.setAttribute('aria-hidden', 'true');

    const toolbar = document.createElement('div');
    toolbar.className = 'image-viewer__toolbar';

    const makeControl = (label, text, className) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `image-viewer__control ${className}`;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.textContent = text;
      toolbar.appendChild(button);
      return button;
    };
    const makeLink = (label, text, className) => {
      const link = document.createElement('a');
      link.className = `image-viewer__control ${className}`;
      link.setAttribute('aria-label', label);
      link.title = label;
      link.textContent = text;
      toolbar.appendChild(link);
      return link;
    };

    const zoomOutButton = makeControl('Zoom out', '−', 'image-viewer__zoom-out');
    const zoomInButton = makeControl('Zoom in', '+', 'image-viewer__zoom-in');
    const resetButton = makeControl('Reset zoom', 'Reset', 'image-viewer__reset');
    const fullscreenButton = makeControl('Full screen', 'Full Screen', 'image-viewer__fullscreen');
    const downloadLink = makeLink('Download original image', 'Download', 'image-viewer__download');
    downloadLink.download = 'REAL.jpeg';
    const originalLink = makeLink('Open original image in a new tab', 'Open Original', 'image-viewer__original');
    originalLink.target = '_blank';
    originalLink.rel = 'noopener noreferrer';
    const closeButton = makeControl('Close image viewer', '×', 'image-viewer__close');
    const status = document.createElement('span');
    status.className = 'image-viewer__status';
    status.setAttribute('aria-live', 'polite');
    toolbar.appendChild(status);

    const stage = document.createElement('div');
    stage.className = 'image-viewer__stage';
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', 'Image viewing area');
    const viewerImage = document.createElement('img');
    viewerImage.className = 'image-viewer__image';
    viewerImage.alt = homePhoto.alt;
    viewerImage.draggable = false;
    viewerImage.hidden = true;
    stage.appendChild(viewerImage);
    viewer.append(toolbar, stage);
    body.appendChild(viewer);

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let previousOverflow = '';
    let previousRootOverflow = '';
    let dragStart = null;
    let pinchStart = null;
    let imageLoaded = false;
    let openState = false;
    let closeTimer = 0;
    let focusTimer = 0;
    let openingFrame = 0;
    const activePointers = new Map();
    const minScale = 1;
    const maxScale = 5;
    const transitionDuration = 240;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const limitPan = () => {
      const maxX = Math.max(0, (viewerImage.offsetWidth * scale - stage.clientWidth) / 2);
      const maxY = Math.max(0, (viewerImage.offsetHeight * scale - stage.clientHeight) / 2);
      translateX = clamp(translateX, -maxX, maxX);
      translateY = clamp(translateY, -maxY, maxY);
    };
    const renderImage = () => {
      limitPan();
      viewerImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      viewerImage.classList.toggle('is-zoomed', scale > 1);
    };
    const setScale = (nextScale, point) => {
      const next = clamp(nextScale, minScale, maxScale);
      if (point && next !== scale) {
        const bounds = stage.getBoundingClientRect();
        const x = point.x - (bounds.left + bounds.width / 2);
        const y = point.y - (bounds.top + bounds.height / 2);
        const ratio = next / scale;
        translateX = x - (x - translateX) * ratio;
        translateY = y - (y - translateY) * ratio;
      }
      scale = next;
      renderImage();
    };
    const resetImage = () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      renderImage();
    };
    const closeViewer = () => {
      if (!openState) return;
      openState = false;
      viewer.classList.remove('is-open');
      viewer.setAttribute('aria-hidden', 'true');
      viewer.setAttribute('aria-busy', 'false');
      window.clearTimeout(closeTimer);
      window.clearTimeout(focusTimer);
      closeTimer = window.setTimeout(() => {
        if (!openState) viewer.hidden = true;
      }, transitionDuration);
      body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      if (document.fullscreenElement === viewer && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          status.textContent = 'Could not exit full screen.';
        });
      }
      homePhoto.focus();
    };
    const openViewer = () => {
      if (openState) return;
      openState = true;
      window.clearTimeout(closeTimer);
      window.clearTimeout(focusTimer);
      window.cancelAnimationFrame(openingFrame);
      const imageSource = homePhoto.currentSrc || homePhoto.src;
      downloadLink.href = imageSource;
      originalLink.href = imageSource;
      viewerImage.alt = homePhoto.alt;
      viewer.setAttribute('aria-busy', String(!imageLoaded || viewerImage.src !== imageSource));
      if (imageLoaded && viewerImage.src === imageSource) {
        viewerImage.hidden = false;
        status.textContent = '';
      } else {
        imageLoaded = false;
        viewerImage.hidden = true;
        status.textContent = 'Loading original image…';
        viewerImage.removeAttribute('src');
        viewerImage.src = imageSource;
      }
      resetImage();
      previousOverflow = body.style.overflow;
      previousRootOverflow = document.documentElement.style.overflow;
      body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      viewer.hidden = false;
      viewer.setAttribute('aria-hidden', 'false');
      openingFrame = window.requestAnimationFrame(() => {
        if (!openState) return;
        viewer.classList.add('is-open');
        // Move focus after the triggering pointer click finishes its default focus action.
        focusTimer = window.setTimeout(() => {
          if (openState) closeButton.focus();
        }, 50);
      });
    };

    viewerImage.addEventListener('load', () => {
      imageLoaded = true;
      viewerImage.hidden = false;
      viewer.setAttribute('aria-busy', 'false');
      status.textContent = '';
    });
    viewerImage.addEventListener('error', () => {
      imageLoaded = false;
      viewerImage.hidden = true;
      viewer.setAttribute('aria-busy', 'false');
      status.textContent = 'The original image could not be loaded. Close the viewer and try again.';
    });

    homePhoto.tabIndex = 0;
    homePhoto.setAttribute('role', 'button');
    homePhoto.setAttribute('aria-label', `View image: ${homePhoto.alt}`);
    homePhoto.addEventListener('click', openViewer);
    homePhoto.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openViewer();
      }
    });

    closeButton.addEventListener('click', closeViewer);
    resetButton.addEventListener('click', resetImage);
    zoomInButton.addEventListener('click', () => setScale(scale * 1.25));
    zoomOutButton.addEventListener('click', () => setScale(scale / 1.25));
    viewer.addEventListener('click', (event) => {
      if (event.target === viewer || event.target === stage) closeViewer();
    });
    document.addEventListener('keydown', (event) => {
      if (!openState) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeViewer();
      } else if (event.key === 'Tab') {
        const focusable = Array.from(viewer.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || !viewer.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !viewer.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === '+' || event.key === '=') {
        setScale(scale * 1.25);
      } else if (event.key === '-') {
        setScale(scale / 1.25);
      } else if (event.key === '0') {
        resetImage();
      }
    });

    stage.addEventListener('wheel', (event) => {
      event.preventDefault();
      setScale(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), { x: event.clientX, y: event.clientY });
    }, { passive: false });

    stage.addEventListener('pointerdown', (event) => {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
      if (activePointers.size === 1 && scale > 1) {
        dragStart = { x: event.clientX, y: event.clientY, translateX, translateY };
      } else if (activePointers.size === 2) {
        const [first, second] = [...activePointers.values()];
        pinchStart = {
          distance: Math.hypot(second.x - first.x, second.y - first.y),
          scale,
          translateX,
          translateY,
          midpointX: (first.x + second.x) / 2,
          midpointY: (first.y + second.y) / 2
        };
        dragStart = null;
      }
    });
    stage.addEventListener('pointermove', (event) => {
      if (!activePointers.has(event.pointerId)) return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size > 1 && pinchStart) {
        const [first, second] = [...activePointers.values()];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (pinchStart.distance > 0) {
          const midpointX = (first.x + second.x) / 2;
          const midpointY = (first.y + second.y) / 2;
          const nextScale = clamp(pinchStart.scale * distance / pinchStart.distance, minScale, maxScale);
          const bounds = stage.getBoundingClientRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          const initialPointX = pinchStart.midpointX - centerX;
          const initialPointY = pinchStart.midpointY - centerY;
          const currentPointX = midpointX - centerX;
          const currentPointY = midpointY - centerY;
          translateX = currentPointX - (initialPointX - pinchStart.translateX) * nextScale / pinchStart.scale;
          translateY = currentPointY - (initialPointY - pinchStart.translateY) * nextScale / pinchStart.scale;
          scale = nextScale;
          renderImage();
        }
      } else if (dragStart && scale > 1) {
        translateX = dragStart.translateX + event.clientX - dragStart.x;
        translateY = dragStart.translateY + event.clientY - dragStart.y;
        renderImage();
      }
    });
    const endPointer = (event) => {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) pinchStart = null;
      if (activePointers.size === 1 && scale > 1) {
        const [point] = activePointers.values();
        dragStart = { x: point.x, y: point.y, translateX, translateY };
      } else if (!activePointers.size) {
        dragStart = null;
      }
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    fullscreenButton.addEventListener('click', async () => {
      status.textContent = '';
      try {
        if (document.fullscreenElement === viewer) {
          await document.exitFullscreen();
        } else if (viewer.requestFullscreen) {
          await viewer.requestFullscreen();
        } else {
          status.textContent = 'Full screen is not supported in this browser.';
        }
      } catch (error) {
        status.textContent = 'Could not change full screen mode.';
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = document.fullscreenElement === viewer;
      fullscreenButton.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
      fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Exit full screen' : 'Full screen');
      fullscreenButton.title = isFullscreen ? 'Exit full screen' : 'Full screen';
    });
  }

  const getStoredLanguage = () => {
    try {
      return localStorage.getItem('miLanguage') || 'en';
    } catch (error) {
      return 'en';
    }
  };
  const persistLanguage = (nextLang) => {
    try {
      localStorage.setItem('miLanguage', nextLang);
    } catch (error) {
      // Ignore storage failures in restricted or non-browser contexts.
    }
  };
  const langPreference = getStoredLanguage();
  body.dataset.language = langPreference;
  document.documentElement.lang = langPreference === 'si' ? 'si' : 'en';

  const notificationAttemptKey = 'miNotificationPermissionAttempted';
  const getNotificationPermission = () => {
    try {
      if (!('Notification' in window) || window.isSecureContext === false) return null;
      return Notification.permission;
    } catch (error) {
      return null;
    }
  };
  const notificationPermission = getNotificationPermission();

  if (notificationPermission === 'default') {
    const prompt = document.createElement('aside');
    prompt.className = 'notification-permission-prompt';
    prompt.setAttribute('aria-label', 'Browser notification permission');
    prompt.hidden = true;

    const copy = document.createElement('div');
    const title = document.createElement('strong');
    const titleEnglish = document.createElement('span');
    titleEnglish.className = 'lang-en';
    titleEnglish.textContent = 'Stay informed';
    const titleSinhala = document.createElement('span');
    titleSinhala.className = 'lang-si';
    titleSinhala.textContent = 'තොරතුරු දැනගන්න';
    title.append(titleEnglish, titleSinhala);

    const description = document.createElement('p');
    const descriptionEnglish = document.createElement('span');
    descriptionEnglish.className = 'lang-en';
    descriptionEnglish.textContent = 'Allow browser notifications for future company updates.';
    const descriptionSinhala = document.createElement('span');
    descriptionSinhala.className = 'lang-si';
    descriptionSinhala.textContent = 'ඉදිරි සමාගම් යාවත්කාලීන සඳහා බ්‍රවුසර දැනුම්දීම්වලට අවසර දෙන්න.';
    description.append(descriptionEnglish, descriptionSinhala);

    const status = document.createElement('p');
    status.className = 'notification-permission-status';
    status.setAttribute('aria-live', 'polite');

    const button = document.createElement('button');
    button.className = 'notification-permission-button';
    button.type = 'button';
    const buttonEnglish = document.createElement('span');
    buttonEnglish.className = 'lang-en';
    buttonEnglish.textContent = 'Enable notifications';
    const buttonSinhala = document.createElement('span');
    buttonSinhala.className = 'lang-si';
    buttonSinhala.textContent = 'දැනුම්දීම් සක්‍රිය කරන්න';
    button.append(buttonEnglish, buttonSinhala);

    copy.append(title, description, status);
    prompt.append(copy, button);
    body.appendChild(prompt);

    const showPrompt = (message) => {
      status.replaceChildren();
      if (message) {
        const english = document.createElement('span');
        english.className = 'lang-en';
        english.textContent = 'If no browser prompt appears, use the button to try again.';
        const sinhala = document.createElement('span');
        sinhala.className = 'lang-si';
        sinhala.textContent = 'බ්‍රවුසර අවසර පණිවිඩය නොපෙනේ නම්, නැවත උත්සාහ කිරීමට බොත්තම භාවිත කරන්න.';
        status.append(english, sinhala);
      }
      prompt.hidden = false;
    };

    const requestNotificationPermission = async () => {
      if (getNotificationPermission() !== 'default') {
        prompt.remove();
        return;
      }

      button.disabled = true;
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted' || permission === 'denied') {
          prompt.remove();
        } else {
          showPrompt(true);
        }
      } catch (error) {
        showPrompt(true);
      } finally {
        if (prompt.isConnected) button.disabled = false;
      }
    };

    button.addEventListener('click', requestNotificationPermission);

    let autoRequestAttempted = false;
    try {
      autoRequestAttempted = sessionStorage.getItem(notificationAttemptKey) === 'true';
      if (!autoRequestAttempted) {
        sessionStorage.setItem(notificationAttemptKey, 'true');
      }
    } catch (error) {
      autoRequestAttempted = false;
    }

    if (autoRequestAttempted) {
      showPrompt(true);
    } else {
      requestNotificationPermission();
    }
  }

  const navLinks = document.querySelector('.nav-links');
  if (navLinks && !navLinks.querySelector('.nav-item.dropdown')) {
    const companyDropdown = document.createElement('div');
    companyDropdown.className = 'nav-item dropdown';
    const dropdownButton = document.createElement('button');
    dropdownButton.type = 'button';
    dropdownButton.className = 'nav-dropdown-button';
    dropdownButton.textContent = 'Company';
    dropdownButton.setAttribute('aria-expanded', 'false');
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'dropdown-menu';
    const companyPages = [
      { href: 'about.html', label: 'About Us' },
      { href: 'company-history.html', label: 'Company History' },
      { href: 'vision-mission.html', label: 'Vision & Mission' },
      { href: 'leadership.html', label: 'Leadership' },
      { href: 'departments.html', label: 'Company Divisions' }
    ];

    companyPages.forEach(({ href, label }) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (window.location.pathname.split('/').pop() === href) {
        link.classList.add('active');
      }
      dropdownMenu.appendChild(link);
    });

    companyDropdown.appendChild(dropdownButton);
    companyDropdown.appendChild(dropdownMenu);
    navLinks.insertBefore(companyDropdown, navLinks.firstChild);

    dropdownButton.addEventListener('click', () => {
      const open = dropdownMenu.classList.toggle('open');
      dropdownButton.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (event) => {
      if (!companyDropdown.contains(event.target)) {
        dropdownMenu.classList.remove('open');
        dropdownButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const primaryNavLabels = {
    'index.html': { en: 'Home', si: 'මුල් පිටුව' },
    'about.html': { en: 'About Us', si: 'අපි ගැන' },
    'services.html': { en: 'Products and Services', si: 'නිෂ්පාදන සහ සේවා' },
    'projects.html': { en: 'Projects', si: 'ව්‍යාපෘති' },
    'sub-companies.html': { en: 'Sub Companies', si: 'උප සමාගම්' },
    'careers.html': { en: 'Career', si: 'වෘත්තීය අවස්ථා' },
    'contact.html': { en: 'Contact Us', si: 'අප හා සම්බන්ධ වන්න' }
  };
  navLinks?.querySelectorAll('a[href]').forEach((link) => {
    const labels = primaryNavLabels[link.getAttribute('href')];
    if (!labels) return;
    const englishLabel = link.querySelector('.lang-en');
    const sinhalaLabel = link.querySelector('.lang-si');
    if (englishLabel) englishLabel.textContent = labels.en;
    else link.textContent = labels.en;
    if (sinhalaLabel) sinhalaLabel.textContent = labels.si;
  });

  const textTranslations = {
    'Home': 'මුල් පිටුව',
    'About Us': 'අපි ගැන',
    'About': 'අපි ගැන',
    'Company History': 'සමාගම් ඉතිහාසය',
    'Vision & Mission': 'දැක්ම සහ මෙහෙවර',
    'Leadership': 'නායකත්වය',
    'Company Divisions': 'සමාගම් අංශ',
    'Departments': 'අංශ',
    'Services': 'සේවා',
    'Projects': 'ව්‍යාපෘති',
    'Portfolio': 'පෝර්ටෆෝලියෝ',
    'Achievements': 'සාර්ථකීම්',
    'News & Updates': 'ප්‍රවෘත්ති සහ යාවත්කාලීන කිරීම්',
    'Sub-Companies': 'උප සමාගම්',
    'Sub Companies': 'උප සමාගම්',
    'Careers': 'රැකියා අවස්ථා',
    'Career': 'වෘත්තීය අවස්ථා',
    'Contact': 'සම්බන්ධ වන්න',
    'Contact Us': 'අප හා සම්බන්ධ වන්න',
    'Products and Services': 'නිෂ්පාදන සහ සේවා',
    'FAQ': 'නිතර අසන ප්‍රශ්න',
    'Privacy Policy': 'පෞද්ගලිකත්ව ප්‍රතිපත්තිය',
    'Terms & Conditions': 'නියමයන් සහ කොන්දේසි',
    'Get in touch': 'සම්බන්ධ වන්න',
    'Search': 'සොයන්න',
    'Sri Lanka': 'ශ්‍රී ලංකාව',
    'Founded': 'තනන ලද්දේ',
    'Proposed Brands': 'යෝජිත බ්‍රෑන්ඩ්',
    'Designing intelligent futures.': 'බුද්ධිමත් අනාගත නිර්මාණය කිරීම.',
    'Technology with purpose, innovation with responsibility.': 'උපයෝගිතාව සහ වගකීම සමඟ තාක්ෂණය.',
    'AI & Digital Innovation': 'AI සහ ඩිජිටල් නවෝත්පාදනය',
    'Software Engineering': 'මෘදුකාංග ඉංජිනේරු',
    'Global Vision': 'ගෝලීය දැක්ම',
    'Official website for a Sri Lankan technology company focused on AI, software, and digital innovation.': 'AI, මෘදුකාංග සහ ඩිජිටල් නවෝත්පාදනය කෙරෙහි අවධානය යොමු කරන ශ්‍රී ලාංකික තාක්ෂණ සමාගමක නිල වෙබ් අඩවිය.',
    'Applications Opening in 2029': '2029 දී අයදුම්පත් විවෘත වේ',
    'Applications are now open.': 'අයදුම්පත් දැන් විවෘතයි.',
    'Applications are now open': 'අයදුම්පත් දැන් විවෘතයි',
    'Company overview': 'සමාගම් දළ විශ්ලේෂණය',
    'Company Overview': 'සමාගම් දළ විශ්ලේෂණය',
    'AI Automation & AI Solutions': 'AI ස්වයංක්‍රියකරණය සහ AI විසඳුම්',
    'Custom Software Development': 'අභිරුචි මෘදුකාංග සංවර්ධනය',
    'Website & Web Application Development': 'වෙබ් අඩවිය සහ වෙබ් යෙදුම් සංවර්ධනය',
    'Mobile Application Development': 'ජංගම යෙදුම් සංවර්ධනය',
    'UI/UX Design': 'UI/UX නිර්මාණය',
    'Digital Product Development': 'ඩිජිටල් නිෂ්පාදන සංවර්ධනය',
    'Technology Consulting': 'තාක්ෂණ උපදෙස්',
    'Cloud-Based Solutions': 'කලාපීය මගින් සපයන විසඳුම්',
    'IT Support & Maintenance': 'IT සහාය සහ නඩත්තු',
    'Educational Technology Solutions': 'අධ්‍යාපන තාක්ෂණ විසඳුම්',
    'Fixed Pricing': 'ස්ථිර මිලකරණය',
    'Custom Quotation': 'අභිරුචි මිල දර්ශනය',
    'Admin-managed': 'පරිපාලක-කළමනාකරණය',
    'Service administration': 'සේවා කළමනාකරණය',
    'CORTEX CORE AI (MI AI)': 'CORTEX CORE AI (MI AI)',
    'CANVA PRO Digital Access Platform': 'CANVA PRO ඩිජිටල් ප්‍රවේශ වේදිකාව',
    'AUTO-CARD-MARKING System': 'AUTO-CARD-MARKING පද්ධතිය',
    'This is a frontend-only demo form. Production submission requires a secure backend, database, and email delivery configuration.': 'මෙය ඉදිරිපස පරිදි පමණක් ක්‍රියා කරනා ආකාරයේ අයදුම්පත් පෝරමයකි. නිෂ්පාදන දියත් කිරීම සඳහා සුරක්ෂිත බැක්එන්ඩ්, දත්ත ගබඩාවක් සහ විද්‍යුත් තැපෑල සැකසීම අවශ්‍ය වේ.',
    'Please complete all required fields before submitting this form.': 'ආකෘතය ඉදිරිපත් කිරීමට පෙර අවශ්‍ය සියලු ක්ෂේත්‍ර පුරවන්න.',
    'Site search': 'වෙබ් අඩවිය සොයන්න',
    'Search services, projects, sub-companies, departments...': 'සේවා, ව්‍යාපෘති, උප සමාගම්, අංශ සොයන්න...',
    'Type a keyword to find company services, projects, departments or sub-company pages.': 'සමාගම් සේවා, ව්‍යාපෘති, අංශ හෝ උප සමාගම් පිටු සොයාගැනීමට මූලපදයක් ටයිප් කරන්න.',
    'No public pages matched your search. Try “AI”, “services”, “careers”, or “sub-company”.': 'ඔබේ සෙවීමට ගැළපෙන ප්‍රසිද්ධ පිටු නොමැත. “AI”, “services”, “careers”, හෝ “sub-company” සොයන්න.',
    'Home / About Us': 'මුල් පිටුව / අපි ගැන',
    'Home / Services': 'මුල් පිටුව / සේවා',
    'Home / Projects': 'මුල් පිටුව / ව්‍යාපෘති',
    'Home / Sub-Companies': 'මුල් පිටුව / උප සමාගම්',
    'Home / Careers': 'මුල් පිටුව / රැකියා',
    'Home / Contact': 'මුල් පිටුව / සම්බන්ධ වන්න',
    'Home / FAQ': 'මුල් පිටුව / නිතර අසන ප්‍රශ්න',
    'Home / Privacy Policy': 'මුල් පිටුව / පෞද්ගලිකත්ව ප්‍රතිපත්තිය',
    'Home / Terms & Conditions': 'මුල් පිටුව / නියමයන් සහ කොන්දේසි',
    'Official website...': 'නිල වෙබ් අඩවිය...',
    'All rights reserved.': 'සියලු හිමිකම් ඇවිරිණී.',
    'Submit application': 'අයදුම් ඉදිරිපත් කරන්න',
    'Send message': 'පණිවුඩය යවන්න',
    'Applications will open in 2029': 'අයදුම්පත් 2029 දී විවෘත වේ',
    'Future recruitment': 'අනාගත රැකියා',
    'Online application form': 'අයදුම් පෝරමය',
    'Register interest': 'උනන්දුව ලකුණු කරන්න',
    'Full name': 'සම්පූර්ණ නම',
    'Email address': 'ඊමේල් ලිපිනය',
    'Email': 'ඊමේල්',
    'Position category': 'තනතුරේ වර්ගය',
    'CV / Resume upload': 'CV / Resume upload',
    'Message': 'පණිවිඩය',
    'Choose a category': 'වර්ගය තෝරන්න',
    'C-Level Positions': 'C-ලෙවල තනතුරු',
    'Managers': 'කළමනාකරුවන්',
    'Supervisors': 'අධීක්ෂකවරු',
    'Employees': 'සේවකයින්',
    'Other Positions': 'වෙනත් තනතුරු',
    'Support': 'සහාය',
    'Explore': 'ගවේෂණය',
    'Company': 'සමාගම',
    'Admin': 'පරිපාලක',
    'Current status:': 'වත්මන් තත්ත්වය:',
    'Current status': 'වත්මන් තත්ත්වය',
    'Main company contacts': 'ප්‍රධාන සමාගම් සම්බන්ධතා',
    'Email:': 'ඊමේල්:',
    'WhatsApp:': 'වට්ස්ඇප්:',
    'Telegram:': 'ටෙලිග්‍රෑම්:',
    'Office Address:': 'කාර්යාල ලිපිනය:',
    'Programme contact channels': 'වැඩසටහන් සම්බන්ධතා මාර්ග',
    'Registration Details:': 'ලියාපදිංචි විස්තර:',
    'Personal Assistance:': 'පුද්ගලික සහාය:',
    'Points & Rankings:': 'ලකුණු සහ ශ්‍රේණි:',
    'Other Inquiries:': 'වෙනත් විමසුම්:',
    'Direct-call and WhatsApp options are provided for these programme contacts. The main MI CORTEX X INC. WhatsApp number should not replace these programme lines.': 'මෙම වැඩසටහන් සම්බන්ධතා සඳහා සෘජු-අමතමිනුම් සහ වට්ස්ඇප් විකල්ප සපයනු ලැබේ. ප්‍රධාන MI CORTEX X INC. වට්ස්ඇප් අංකය මෙම වැඩසටහන් අංක වෙනුවට නොගැලපේ.',
    'Send an inquiry': 'විමසීමක් යවන්න',
    'Your full name': 'ඔබගේ සම්පූර්ණ නම',
    'Subject': 'විෂය',
    'Inquiry subject': 'විමසුම් විෂය',
    'Privacy consent': 'පෞද්ගලිකත්ව එකඟතාව',
    'I agree to the privacy notice and understand this form is for inquiry handling.': 'මම පෞද්ගලිකත්ව දැන්වීම සමඟ එකඟ වන අතර මෙම පෝරමය විමසුම් කළමනාකරණය සඳහා පමණක් යෙදෙන බව දනිමි.',
    'Frequently Asked Questions': 'නිතර අසන ප්‍රශ්න',
    'Is MI CORTEX X INC. registered?': 'MI CORTEX X INC. ලියාපදිංචිද?',
    'What services do you offer?': 'ඔබ කුමන සේවා සපයන්නේද?',
    'Are the sub-companies already active?': 'උප සමාගම් දැනටමත් ක්‍රියාකාරීද?',
    'When do career applications open?': 'රැකියා අයදුම්පත් කවදා විවෘත වේ?',
    'Are the project websites fully interactive backends?': 'ව්‍යාපෘති වෙබ් අඩවිවල සම්පූර්ණ අන්තර්ක්‍රියාකාරී backends තිබේද?',
    'The company has not yet been legally registered. The website therefore avoids making legal incorporation claims or presenting unverified registration details.': 'සමාගම තවමත් නීත්‍යානුකූලව ලියාපදිංචි වී නොමැත. එබැවින් වෙබ් අඩවිය නීතිමය ලියාපදිංචි ප්‍රකාශ කිරීම් නොකරයි.',
    'The confirmed service categories include AI automation, custom software development, web and mobile app development, UI/UX design, digital products, consulting, cloud solutions, IT support, and educational technology solutions.': 'සත්‍යාපිත සේවා කාණ්ඩවලට AI ස්වයංක්‍රියකරණය, අභිරුචි මෘදුකාංග සංවර්ධනය, වෙබ් සහ ජංගම යෙදුම් සංවර්ධනය, UI/UX නිර්මාණය, ඩිජිටල් නිෂ්පාදන, උපදේශනය, Cloud-පාදක විසඳුම්, IT සහාය සහ අධ්‍යාපන තාක්ෂණ විසඳුම් ඇතුළත් වේ.',
    'No. All proposed sub-company brands are publicly presented as PROPOSED future brands and are not displayed as operational or legally registered subsidiaries.': 'නැත. සියලු යෝජිත උප සමාගම් බ්‍රෑන්ඩ් ප්‍රසිද්ධියේ PROPOSED අනාගත බ්‍රෑන්ඩ් ලෙස පෙන්වනු ලබ며 ක්‍රියාත්මක හෝ නීතිමයව ලියාපදිංචි උප සමාගම් ලෙස නොපෙන්වනු ලැබේ.',
    'Applications are not accepted before 2029-01-01 in Asia/Colombo time. Until then, the site displays “Applications Opening in 2029”.': '2029-01-01 ට පෙර Asia/Colombo කාලයට අයදුම්පත් පිළිගනු නොලැබේ. එතෙක් වෙබ් අඩවිය “2029 දී අයදුම්පත් විවෘත වේ” ලෙස පෙන්වයි.',
    'Each project page reflects the public-facing website and confirmed project information available at the time of publishing. They are not presented as secure production environments unless separately confirmed.': 'එක් එක් ව්‍යාපෘති පිටුව ප්‍රකාශයට පත් වෙබ් අඩවිය සහ ප්‍රකාශයට පත් විය හැකි සත්‍යාපිත තොරතුරු ප්‍රදර්ශනය කරයි. වෙනම සත්‍යාපනය කර නොමැති නම් ඒවා ආරක්ෂිත නිෂ්පාදන පරිසර ලෙස පෙන්වනු නොලැබේ.',
    'Important note': 'වැදගත් සටහන',
    'Scope': 'විෂය පථය',
    'This website is a public-facing corporate website and is not an internal operations system, enterprise platform, or company management portal.': 'මෙය ප්‍රසිද්ධියේ පෙන්වන සමාගම් වෙබ් අඩවියක් olup අභ්‍යන්තර මෙහෙයුම් පද්ධතියක්, ව්‍යාපාරික වේදිකාවක් හෝ සමාගම් කළමනාකරණ පෝට්ලිට් නොවේ.',
    'MI CORTEX X INC. is committed to handling personal information responsibly and only for legitimate business and service-related purposes.': 'MI CORTEX X INC. පුද්ගලික තොරතුරු වගකීමෙන් හැසිරවීමට කැමැත්තක් දක්වයි. එය සුදුසු ව්‍යාපාරික හා සේවා-සම්බන්ධ හේතූන් සඳහා පමණක් භාවිත කරයි.',
    'Information collected through inquiries, newsletter subscriptions, and application forms may be used to respond to customer questions, manage service requests, review applications, and improve public communication.': 'විමසුම්, පත්‍රිකාගතවීම, සහ අයදුම් පෝරම හරහා එකතු කරන ලද තොරතුරු, පාරිභෝගික ප්‍රශ්නවලට පිළිතුරු දීම, සේවා ඉල්ලීම් කළමනාකරණය, අයදුම් සමාලෝචනය සහ මහජන සන්නිවේදනය වැඩිදියුණු කිරීම සඳහා භාවිත කළ හැක.',
    'This website uses privacy-sensitive practices and should be designed to include consent notices, secure form handling, and unsubscribe mechanisms for newsletter subscribers.': 'මෙම වෙබ් අඩවිය පෞද්ගලිකත්ව-සංවේදී ප්‍රතිපත්ති භාවිත කරයි. එය එකඟතාව දැනුම් දීම, ආරක්ෂිත පෝරම හැසිරවීම සහ පත්‍රිකාගතවීම් අවලංගු කිරීමේ ක්‍රම සම්බන්ධ කිරීම අවශ්‍ය වේ.',
    'Data collection, retention, and use must reflect the website’s actual practices and must remain consistent with the company’s verified service scope.': 'දත්ත එකතු කිරීම, රඳවා ගැනීම සහ භාවිතය වෙබ් අඩවියෙහි සැබෑ භාවිතයන් අනුව සිදු කළ යුතු අතර සමාගමේ සත්‍යාපිත සේවා පරාසරයට ගැලපිය යුතුය.',
    'By using this website, visitors agree that the content is provided for informational and public communication purposes only. The company may update, revise, or remove information as needed to maintain accuracy and consistency with verified facts.': 'මෙම වෙබ් අඩවිය භාවිතා කිරීමෙන්, අමුත්තන් එකඟ වන්නේ අන්තර්ගතය පමණක් දැනුම්දීමේ හා මහජන සන්නිවේදන උදෙසා සපයනු ලබන බවයි. සත්‍යාපිත තොරතුරු සමඟ නිරවද්‍යතාවය සහ අනුකූලතාවය පවත්වා ගැනීම සඳහා සමාගම අවශ්‍ය වූ විට තොරතුරු යාවත්කාලීන කළ හැක.',
    'Any service inquiries, project requests, or quotation requests should be considered preliminary discussions and may require formal review before project commitment or final pricing is agreed.': 'ඕනෑම සේවා විමසුමක්, ව්‍යාපෘති ඉල්ලීමක් හෝ මිල ගණන් ඉල්ලීමක් ආරම්භක සාකච්ඡා ලෙස සලකනු ලබන අතර, ව්‍යාපෘති පිළිගැනීම හෝ අවසාන මිලකරණය පිළිබඳව සම්මත වීමට පෙර විධිමත් සමාලෝචනය අවශ්‍ය විය හැක.',
    'Official website for a Sri Lankan technology company focused on AI, software, and digital innovation.': 'AI, මෘදුකාංග සහ ඩිජිටල් නවෝත්පාදනය කෙරෙහි අවධානය යොමු කරන ශ්‍රී ලාංකික තාක්ෂණ සමාගමක නිල වෙබ් අඩවිය.',
    'Explore': 'ගවේෂණය',
    'Company': 'සමාගම',
    'Admin': 'පරිපාලක',
    'Company overview': 'සමාගම් දළ විශ්ලේෂණය',
    'Home / Achievements': 'මුල් පිටුව / සාර්ථකීම්',
    'Home / News & Updates': 'මුල් පිටුව / ප්‍රවෘත්ති සහ යාවත්කාලීන කිරීම්',
    'Home / Leadership': 'මුල් පිටුව / නායකත්වය',
    'Home / Vision & Mission': 'මුල් පිටුව / දැක්ම සහ මෙහෙවර',
    'Current status:': 'වත්මන් තත්ත්වය:',
    'Current status': 'වත්මන් තත්ත්වය',
    'Search services, projects, sub-companies, departments...': 'සේවා, ව්‍යාපෘති, උප සමාගම්, අංශ සොයන්න...',
    'Type a keyword to find company services, projects, departments or sub-company pages.': 'සමාගම් සේවා, ව්‍යාපෘති, අංශ හෝ උප සමාගම් පිටු සොයාගැනීමට මූලපදයක් ටයිප් කරන්න.',
    'AI Platform': 'AI වේදිකාව',
    'Active Project': 'ක්‍රියාකාරී ව්‍යාපෘතිය',
    'About MI CORTEX X INC.': 'MI CORTEX X INC. ගැන',
    'A Sri Lankan technology company focused on AI, software, and digital growth.': 'AI, මෘදුකාංග සහ ඩිජිටල් වර්ධනය කෙරෙහි අවධානය යොමු කරන ශ්‍රී ලාංකික තාක්ෂණ සමාගමක්.',
    'Company Story': 'සමාගම් කතාව',
    'Built around vision, technology, and service.': 'දැක්ම, තාක්ෂණය සහ සේවය මත ගොඩනගා ගත්.',
    'History': 'ඉතිහාසය',
    'Company timeline': 'සමාගම් කාල පේළිය',
    'Values': 'ගරුත්වය',
    'The principles behind our work': 'අපගේ වැඩවල පසුබිම',
    'Innovation': 'නවෝත්පාදනය',
    'Excellence': 'උතුම්කම',
    'Integrity': 'නීතිමය අඛණ්ඩතාව',
    'Quality': 'ගුණාත්මකභාවය',
    'Creativity': 'නිර්මාණාත්මකභාවය',
    'Reliability': 'විශ්වාසවන්තභාවය',
    'Customer Satisfaction': 'පාරිභෝගික තෘප්තිය',
    'Security & Privacy': 'ආරක්ෂාව සහ පෞද්ගලිකත්වය',
    'Continuous Learning': 'අඛණ්ඩ ඉගෙනීම',
    'Global Collaboration': 'ගෝලීය සහයෝගීතාව',
    'Our Services': 'අපගේ සේවා',
    'Core Services': 'ප්‍රධාන සේවා',
    'Choose your focus': 'ඔබේ අවධානය තෝරන්න',
    'Our Projects': 'අපගේ ව්‍යාපෘති',
    'Featured project': 'විශේෂිත ව්‍යාපෘතිය',
    'Continue': 'දිගටම',
    'See all projects': 'සියලු ව්‍යාපෘති බලන්න',
    'Founding year': 'තනන වර්ෂය',
    'Sri Lankan technology company': 'ශ්‍රී ලාංකික තාක්ෂණ සමාගම',
    'Mission': 'මෙහෙවර',
    'Vision': 'දැක්ම',
    'Download profile': 'පැතිකඩ බාගත කරන්න',
    'Open profile': 'පැතිකඩ විවෘත කරන්න',
    'Verified background': 'සත්‍යාපිත පසුබිම',
    'From a focused technology idea to a growing innovation-driven company.': 'කේන්ද්‍රගත තාක්ෂණ අදහසකින් වර්ධනය වෙමින් පවතින නවෝත්පාදන-ඡායාරූප සමාගමක් බවට.',
    'Company identity': 'සමාගම් අනන්‍යතාව',
    'Official profile': 'නිල පැතිකඩ',
    'Find the right opportunity': 'නිවැරදි අවස්ථාව සොයා ගන්න',
    'Applications opening in 2029': '2029 දී අයදුම්පත් විවෘත වේ',
    'Open positions': 'විවෘත තනතුරු',
    'Contact MI CORTEX X INC.': 'MI CORTEX X INC. සම්බන්ධ වන්න',
    'Main company contacts': 'ප්‍රධාන සමාගම් සම්බන්ධතා',
    'Programme contact channels': 'වැඩසටහන් සම්බන්ධතා මාර්ග',
    'Send an inquiry': 'විමසීමක් යවන්න',
    'Personal assistance': 'පුද්ගලික සහාය',
    'Your message': 'ඔබගේ පණිවිඩය',
    'Your email': 'ඔබගේ ඊමේල්',
    'I agree to the privacy notice and understand this form is for inquiry handling.': 'මම පෞද්ගලිකත්ව දැන්වීම සමඟ එකඟ වන අතර මෙය විමසුම් කළමනාකරණය සඳහා පමණක් යෙදෙන බව සම්පූර්ණයෙන් දනිමි.'
  };

  const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const originalTextMap = new WeakMap();
  const originalAttrMap = new WeakMap();

  const applyLanguageSpans = () => {
    const isSinhala = body.dataset.language === 'si';
    document.querySelectorAll('.lang-en, .lang-si').forEach((node) => {
      const shouldShow = node.classList.contains(isSinhala ? 'lang-si' : 'lang-en');
      node.hidden = !shouldShow;
    });
  };

  const applyTextTranslations = () => {
    const isSinhala = body.dataset.language === 'si';
    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let currentNode = textNodes.nextNode();

    while (currentNode) {
      const parent = currentNode.parentElement;
      if (!parent || parent.closest('script, style, noscript, svg, img, input, textarea, select, button')) {
        currentNode = textNodes.nextNode();
        continue;
      }

      const value = normalizeText(currentNode.textContent);
      if (!value) {
        currentNode = textNodes.nextNode();
        continue;
      }

      if (!originalTextMap.has(currentNode)) {
        originalTextMap.set(currentNode, value);
      }

      const original = originalTextMap.get(currentNode);
      const translated = textTranslations[original];
      currentNode.textContent = isSinhala && translated ? translated : original;
      currentNode = textNodes.nextNode();
    }

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      if (!originalAttrMap.has(element)) {
        originalAttrMap.set(element, key);
      }
      const original = originalAttrMap.get(element);
      const translated = textTranslations[original];
      element.textContent = isSinhala && translated ? translated : original;
    });
  };

  const updateLanguageUI = () => {
    const usesLangSpans = document.querySelector('.lang-en, .lang-si');
    if (usesLangSpans) {
      applyLanguageSpans();
      return;
    }
    applyTextTranslations();
  };

  document.querySelectorAll('[data-lang-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLang = button.dataset.langToggle;
      body.dataset.language = nextLang;
      document.documentElement.lang = nextLang === 'si' ? 'si' : 'en';
      persistLanguage(nextLang);
      updateLanguageUI();
      document.querySelectorAll('[data-lang-toggle]').forEach((langButton) => {
        const active = langButton.dataset.langToggle === nextLang;
        langButton.classList.toggle('active', active);
        langButton.setAttribute('aria-pressed', String(active));
      });
    });
  });

  const yearNode = document.getElementById('year');
  if (yearNode) yearNode.textContent = new Date().getFullYear();

  const dateNode = document.getElementById('careers-open-date');
  if (dateNode) {
    const now = new Date();
    const open = new Date('2029-01-01T00:00:00+05:30');
    if (now >= open) {
      dateNode.textContent = 'Applications are now open.';
    } else {
      dateNode.textContent = 'Applications Opening in 2029';
    }
  }

  const servicesCatalog = document.querySelector('body > main .services-catalog');
  if (servicesCatalog) {
    const form = servicesCatalog.querySelector('.services-filter-form');
    const searchInput = form?.elements.namedItem('search');
    const productCategory = form?.elements.namedItem('productCategory');
    const serviceCategory = form?.elements.namedItem('serviceCategory');
    const premiumFilter = form?.elements.namedItem('premium');
    const productPriceFilter = form?.elements.namedItem('productPrice');
    const pricePeriod = form?.elements.namedItem('pricePeriod');
    const sortSelect = form?.elements.namedItem('sort');
    const resultCount = servicesCatalog.querySelector('.catalog-results-count');
    const emptyState = servicesCatalog.querySelector('.catalog-empty-state');
    const modeButtons = Array.from(servicesCatalog.querySelectorAll('[data-catalog-mode]'));
    const catalogGroups = new Map(
      Array.from(servicesCatalog.querySelectorAll('.catalog-group[data-group]'))
        .map((group) => [group.dataset.group, group])
    );
    const productGroup = catalogGroups.get('products');
    const serviceGroup = catalogGroups.get('services');
    const pricingConditions = servicesCatalog.querySelector('[data-services-only]');
    const productGrid = productGroup?.querySelector('.catalog-grid');
    const productCards = Array.from(productGrid?.querySelectorAll('.product-card') ?? []);
    const serviceCategories = Array.from(serviceGroup?.querySelectorAll('.service-category') ?? []);
    const serviceItems = Array.from(serviceGroup?.querySelectorAll('.service-list .catalog-item') ?? []);
    const productCategoryField = form?.querySelector('[data-filter-for="products"] select[name="productCategory"]');
    const serviceCategoryField = form?.querySelector('[data-filter-for="services"] select[name="serviceCategory"]');
    const productPriceField = form?.querySelector('[data-filter-for="products"] select[name="productPrice"]');
    const premiumField = form?.querySelector('[data-filter-for="products"] select[name="premium"]');
    const productFilters = Array.from(form?.querySelectorAll('[data-filter-for="products"]') ?? []);
    const serviceFilters = Array.from(form?.querySelectorAll('[data-filter-for="services"]') ?? []);
    const periodOptions = Array.from(pricePeriod?.options ?? []);
    const normalise = (value) => value.trim().toLocaleLowerCase();

    const familyDefinitions = [
      { id: 'core-ai', title: 'CORTEX CORE AI', names: ['CORTEX CORE AI (MI AI)'], premium: true },
      { id: 'canva-pro', title: 'CANVA PRO', names: ['CANVA PRO — REAL CANVA PRO ACCESS'] },
      { id: 'cortex-pay', title: 'MI CORTEX PAY', names: ['MI CORTEX PAY'] },
      { id: 'cortex-cloud', title: 'MI CORTEX CLOUD', names: ['MI CORTEX CLOUD'] },
      { id: 'cortex-qr', title: 'MI CORTEX QR', names: ['MI CORTEX QR'] },
      { id: 'cortex-travel', title: 'MI CORTEX TRAVEL', names: ['MI CORTEX TRAVEL'] },
      { id: 'cortex-canvas', title: 'MI CORTEX CANVAS', names: ['MI CORTEX CANVAS'] },
      {
        id: 'office-hub',
        title: 'MI CORTEX OFFICE HUB',
        description: 'MI CORTEX OFFICE HUB brings its office applications together in one unified package. Users can download the Office Hub to access its included applications, or obtain individual applications separately.',
        names: [
          'MI CORTEX OFFICE HUB', 'MI CORTEX WRITER', 'MI CORTEX SHEETS', 'MI CORTEX SLIDES',
          'MI CORTEX PDF', 'MI CORTEX MAIL', 'MI CORTEX CALENDAR', 'MI CORTEX NOTES',
          'MI CORTEX FILES', 'MI CORTEX CALCULATOR'
        ],
        parentName: 'MI CORTEX OFFICE HUB',
        applicationNames: [
          'MI CORTEX WRITER', 'MI CORTEX SHEETS', 'MI CORTEX SLIDES', 'MI CORTEX PDF',
          'MI CORTEX MAIL', 'MI CORTEX CALENDAR', 'MI CORTEX NOTES', 'MI CORTEX FILES',
          'MI CORTEX CALCULATOR'
        ]
      },
      {
        id: 'education',
        title: 'MI CORTEX EDUCATION',
        description: 'MI CORTEX EDUCATION is an educational application family available individually or as one combined Education package.',
        names: [
          'MI CORTEX EDUCATION', 'MI CORTEX CLASSROOM', 'MI CORTEX EXAM', 'MI CORTEX QUIZ',
          'MI CORTEX STUDENT', 'MI CORTEX TEACHER', 'MI CORTEX ATTENDANCE', 'MI CORTEX LIBRARY'
        ],
        parentName: 'MI CORTEX EDUCATION',
        applicationNames: [
          'MI CORTEX CLASSROOM', 'MI CORTEX EXAM', 'MI CORTEX QUIZ', 'MI CORTEX STUDENT',
          'MI CORTEX TEACHER', 'MI CORTEX ATTENDANCE', 'MI CORTEX LIBRARY'
        ]
      },
      { id: 'bazaar', title: 'MI CORTEX BAZAAR', names: ['MI CORTEX BAZAAR'] },
      {
        id: 'communicate-social',
        title: 'COMMUNICATE & SOCIAL',
        names: [
          'MI CORTEX CHAT', 'MI CORTEX MEET', 'MI CORTEX CONNECT', 'MI CORTEX MAIL',
          'MI CORTEX SUPPORT', 'MI CORTEX SOCIAL', 'MI CORTEX INSTA', 'MI CORTEX REELO',
          'MI CORTEX VIDORA', 'MI CORTEX SNAP', 'MI CORTEX TUNES'
        ],
        applicationNames: [
          'MI CORTEX CHAT', 'MI CORTEX MEET', 'MI CORTEX CONNECT', 'MI CORTEX MAIL',
          'MI CORTEX SUPPORT', 'MI CORTEX SOCIAL', 'MI CORTEX INSTA', 'MI CORTEX REELO',
          'MI CORTEX VIDORA', 'MI CORTEX SNAP', 'MI CORTEX TUNES'
        ]
      },
      {
        id: 'ride-foods',
        title: 'RIDE & FOODS',
        names: [
          'MI CORTEX RENT', 'MI CORTEX RIDE', 'MI CORTEX DRIVER', 'MI CORTEX EXPRESS',
          'MI CORTEX FOOD', 'MI CORTEX FRESH', 'MI CORTEX DINE', 'MI CORTEX BAKERY'
        ],
        applicationNames: [
          'MI CORTEX RENT', 'MI CORTEX RIDE', 'MI CORTEX DRIVER', 'MI CORTEX EXPRESS',
          'MI CORTEX FOOD', 'MI CORTEX FRESH', 'MI CORTEX DINE', 'MI CORTEX BAKERY'
        ]
      },
      { id: 'photos', title: 'MI CORTEX PHOTOS', names: ['MI CORTEX PHOTOS'] }
    ];
    const familyById = new Map(familyDefinitions.map((family, index) => {
      family.order = index;
      return [family.id, family];
    }));
    const mailApplications = productCards.filter((card) => normalise(card.dataset.name ?? '') === 'mi cortex mail');
    const mailFamilies = ['office-hub', 'communicate-social'];
    let mailIndex = 0;

    const familyForProduct = (card) => {
      const name = normalise(card.dataset.name ?? card.querySelector('h3')?.textContent ?? '');
      if (name === 'mi cortex mail') {
        const familyId = mailFamilies[mailIndex] ?? 'communicate-social';
        mailIndex += 1;
        return familyById.get(familyId);
      }
      return familyDefinitions.find((family) => (
        family.names.some((familyName) => normalise(familyName) === name)
      ));
    };

    const productFamilies = new Map(familyDefinitions.map((family) => [family.id, []]));
    productCards.forEach((card, index) => {
      const family = familyForProduct(card);
      card.dataset.originalOrder = String(index);
      card.dataset.productFamily = family?.id ?? 'other';
      card.dataset.productFamilyName = family?.title ?? '';
      productFamilies.get(card.dataset.productFamily)?.push(card);
    });

    const createFamilyHeader = (family, needsStatus) => {
      const header = document.createElement('header');
      header.className = 'product-family__header';
      const titleRow = document.createElement('div');
      titleRow.className = 'product-family__title-row';
      const title = document.createElement('h3');
      title.id = `product-family-title-${family.id}`;
      title.textContent = family.title;
      titleRow.appendChild(title);
      if (needsStatus) {
        const status = document.createElement('span');
        status.className = 'status-pill status-pill--pending';
        status.textContent = 'PENDING';
        titleRow.appendChild(status);
      }
      header.appendChild(titleRow);
      if (family.description) {
        const description = document.createElement('p');
        description.className = 'product-family__description';
        description.textContent = family.description;
        header.appendChild(description);
      }
      return header;
    };

    const familyContainer = document.createElement('div');
    familyContainer.className = 'product-families';
    const familyPanels = new Map();
    familyDefinitions.forEach((family) => {
      const panel = document.createElement('section');
      panel.className = 'product-family';
      panel.dataset.productFamily = family.id;
      panel.dataset.originalOrder = String(family.order);
      const isStandalone = family.order < 7 || family.id === 'bazaar' || family.id === 'photos';
      const hasMainProductCard = Boolean(family.parentName);
      const hasApplications = Boolean(family.applicationNames?.length);
      if (!isStandalone) {
        panel.setAttribute('aria-labelledby', `product-family-title-${family.id}`);
        panel.appendChild(createFamilyHeader(family, !hasMainProductCard));
      } else {
        panel.setAttribute('aria-label', family.title);
      }
      const cardsGrid = document.createElement('div');
      cardsGrid.className = 'product-family__grid';
      if (hasApplications) {
        const applicationLabel = document.createElement('h4');
        applicationLabel.className = 'product-family__applications-label';
        applicationLabel.textContent = 'Applications';
        cardsGrid.appendChild(applicationLabel);
      }
      panel.appendChild(cardsGrid);
      familyContainer.appendChild(panel);
      familyPanels.set(family.id, { panel, cardsGrid, family });
    });
    productGrid?.replaceWith(familyContainer);

    const deriveProductPrices = (card) => {
      const prices = {};
      let hasFreePlan = false;
      let hasPaidPlan = false;
      const planRows = Array.from(card.querySelectorAll('.plan-list li'));
      planRows.forEach((row) => {
        const text = row.textContent ?? '';
        const amounts = Array.from(text.matchAll(/Rs\.?\s*([\d,]+)/gi))
          .map((match) => Number(match[1].replace(/,/g, '')))
          .filter(Number.isFinite);
        const lower = normalise(text);
        if (/\bfree\b/.test(lower)) hasFreePlan = true;
        if (amounts.some((amount) => amount > 0)) hasPaidPlan = true;
        if (!amounts.length) return;

        let period = '';
        if (/\bweekly\b/.test(lower)) period = 'weekly';
        else if (/\bmonthly\b/.test(lower)) period = 'monthly';
        else if (/\bannual(?:ly)?\b|\byearly\b/.test(lower)) period = 'yearly';
        else if (/\blifetime\b/.test(lower)) period = 'lifetime';
        if (!period) return;
        amounts.forEach((amount) => {
          prices[period] = prices[period] === undefined ? amount : Math.min(prices[period], amount);
        });
      });

      const note = normalise(card.querySelector('.catalog-item__note')?.textContent ?? '');
      if (/\bfree\b/.test(note)) hasFreePlan = true;
      const family = familyById.get(card.dataset.productFamily);
      if (family?.id === 'office-hub' && family.applicationNames?.includes(card.dataset.name ?? '')) {
        hasPaidPlan = true;
        prices.monthly = 500;
        prices.yearly = 5000;
        const applicationPlan = document.createElement('p');
        applicationPlan.className = 'catalog-item__note';
        applicationPlan.textContent = 'Individual application plan (one selected application): Rs. 500/month or Rs. 5,000/year.';
        card.querySelector('.catalog-item__note')?.replaceWith(applicationPlan);
      } else if (family?.id === 'education' && family.applicationNames?.includes(card.dataset.name ?? '')) {
        const applicationPlan = card.querySelector('.catalog-item__note');
        if (applicationPlan) {
          applicationPlan.textContent = 'Pricing not announced for individual applications. Education package plans are listed with MI CORTEX EDUCATION.';
        }
      }

      card.dataset.hasFree = String(hasFreePlan);
      card.dataset.hasPaid = String(hasPaidPlan);
      Object.entries(prices).forEach(([period, amount]) => {
        card.dataset[`price${period[0].toUpperCase()}${period.slice(1)}`] = String(amount);
      });
      return prices;
    };

    const productPriceMaps = new WeakMap();
    const getSafeBookingUrl = (value) => {
      if (!value) return null;
      try {
        const destination = new URL(value);
        if (
          !['http:', 'https:'].includes(destination.protocol)
          || destination.username
          || destination.password
        ) return null;
        return destination.href;
      } catch {
        return null;
      }
    };

    productCards.forEach((card) => {
      productPriceMaps.set(card, deriveProductPrices(card));
      const family = familyById.get(card.dataset.productFamily);
      const parentName = family?.parentName;
      const cardName = normalise(card.dataset.name ?? '');
      const isApplication = family?.applicationNames?.some((name) => normalise(name) === cardName);
      const destinationUrl = getSafeBookingUrl(card.dataset.destinationUrl);
      if (
        card.querySelector('.status-pill--available')
        && destinationUrl
        && (!isApplication || card.dataset.independentlyBookable === 'true')
      ) {
        const bookingLink = document.createElement('a');
        bookingLink.className = 'catalog-item__booking';
        bookingLink.href = destinationUrl;
        bookingLink.target = '_blank';
        bookingLink.rel = 'noopener noreferrer';
        bookingLink.innerHTML = '<svg class="catalog-item__booking-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3v3m8-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m9 15 2 2 4-4"/></svg><span>BOOK NOW</span><svg class="catalog-item__booking-external" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6m0-6-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>';
        bookingLink.setAttribute('aria-label', `Book ${card.querySelector('.catalog-item__header h3')?.textContent.trim() ?? 'product'}`);
        card.appendChild(bookingLink);
      }
      if (parentName && normalise(parentName) === normalise(card.dataset.name ?? '')) {
        card.classList.add('product-family__package');
        const lead = card.querySelector('.catalog-item__lead');
        if (lead && normalise(lead.textContent ?? '') === normalise(family.description ?? '')) {
          lead.remove();
        }
        const title = card.querySelector('.catalog-item__header h3');
        if (title) title.hidden = true;
        const familyTitleRow = familyPanels.get(family.id)?.panel.querySelector('.product-family__title-row');
        const status = card.querySelector('.status-pill');
        if (familyTitleRow && status) {
          familyTitleRow.appendChild(status);
          card.querySelector('.catalog-item__header')?.remove();
        }
      } else if (family?.applicationNames?.some((name) => normalise(name) === normalise(card.dataset.name ?? ''))) {
        card.classList.add('product-application');
      }
      familyPanels.get(card.dataset.productFamily)?.cardsGrid.appendChild(card);
    });

    const createApplicationLabels = () => {
      familyDefinitions.forEach((family) => {
        const panel = familyPanels.get(family.id)?.panel;
        if (!panel || !family.parentName || !family.applicationNames?.length) return;
        const label = panel.querySelector('.product-family__applications-label');
        if (label) label.textContent = 'Included applications';
      });
    };
    createApplicationLabels();

    const serviceDescriptions = [
      'Website creation, redesign, maintenance and optimization services.',
      'Web applications, platforms, portals and management systems.',
      'Android, iOS and cross-platform applications, design and maintenance.',
      'Artificial intelligence and machine-learning development and integration services.',
      'Custom software and business management systems.',
      'Backend, database, integration and API services.',
      'Cloud, hosting, email and deployment infrastructure services.',
      'Security assessment, implementation and software quality services.',
      'Interface, brand identity and digital creative design services.',
      'Digital marketing strategy, campaign management and reporting services.',
      'Education and online learning platform development services.',
      'Automation, analytics and tailored digital solution services.'
    ];
    const serviceCategoryData = serviceCategories.map((category, index) => {
      const heading = category.querySelector('h3');
      const title = heading?.textContent?.replace(/^\s*\d+\s*[.—-]\s*/, '').trim() ?? `Service category ${index + 1}`;
      const categoryId = `service-${String(index + 1).padStart(2, '0')}`;
      category.dataset.serviceCategory = categoryId;
      if (heading) {
        const description = document.createElement('p');
        description.className = 'service-category__description';
        description.textContent = serviceDescriptions[index] ?? '';
        heading.insertAdjacentElement('afterend', description);
      }
      return { id: categoryId, title };
    });
    serviceItems.forEach((item, index) => {
      const category = item.closest('.service-category');
      item.dataset.serviceCategory = category?.dataset.serviceCategory ?? '';
      item.dataset.originalOrder = String(index);
      const priceText = item.children[1]?.textContent ?? '';
      item.dataset.servicePeriod = /\/\s*month\b/i.test(priceText) ? 'monthly' : 'starting';
      item.dataset.hasFree = 'false';
      item.dataset.hasPaid = 'true';
    });

    if (serviceCategoryField) {
      serviceCategoryData.forEach(({ id, title }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = title;
        serviceCategoryField.appendChild(option);
      });
    }

    const activeMode = { value: 'products' };
    const savedState = {
      products: { search: '', category: 'all', premium: 'all', price: 'any', period: 'monthly', sort: 'default' },
      services: { search: '', category: 'all', period: 'starting', sort: 'default' }
    };

    const currentControls = () => {
      const productsActive = activeMode.value === 'products';
      return {
        category: productsActive ? productCategoryField : serviceCategoryField,
        premium: productsActive ? premiumField : null,
        price: productsActive ? productPriceField : null,
        period: pricePeriod,
        sort: sortSelect
      };
    };

    const saveCurrentState = () => {
      const state = savedState[activeMode.value];
      const controls = currentControls();
      if (!state || !controls.category || !controls.period || !controls.sort || !searchInput) return;
      state.search = searchInput.value;
      state.category = controls.category.value;
      if (controls.price) state.price = controls.price.value;
      state.period = controls.period.value;
      state.sort = controls.sort.value;
      if (controls.premium) state.premium = controls.premium.value;
    };

    const configureModeControls = () => {
      const productsActive = activeMode.value === 'products';
      productFilters.forEach((field) => { field.hidden = !productsActive; });
      serviceFilters.forEach((field) => { field.hidden = productsActive; });
      periodOptions.forEach((option) => {
        const optionMode = option.dataset.periodFor;
        option.hidden = Boolean(optionMode && optionMode !== activeMode.value);
        option.disabled = option.hidden;
      });
      if (searchInput) {
        searchInput.placeholder = productsActive ? 'Search products and applications...' : 'Search services...';
        searchInput.setAttribute('aria-label', productsActive ? 'Search products and applications' : 'Search services');
      }
    };

    const setMode = (mode, savePrevious = true) => {
      if (!catalogGroups.has(mode) || mode === activeMode.value) return;
      if (savePrevious) saveCurrentState();
      activeMode.value = mode;
      modeButtons.forEach((button) => {
        const selected = button.dataset.catalogMode === mode;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      catalogGroups.forEach((group, groupMode) => { group.hidden = groupMode !== mode; });
      if (pricingConditions) pricingConditions.hidden = mode !== 'services';
      configureModeControls();
      const state = savedState[mode];
      if (searchInput) searchInput.value = state.search;
      if (mode === 'products') {
        if (productCategoryField) productCategoryField.value = state.category;
        if (premiumField) premiumField.value = state.premium;
        if (productPriceField) productPriceField.value = state.price;
      } else {
        if (serviceCategoryField) serviceCategoryField.value = state.category;
      }
      if (pricePeriod) pricePeriod.value = state.period;
      if (sortSelect) sortSelect.value = state.sort;
      renderCatalog();
    };

    const readPeriodPrice = (card, period) => {
      const prices = productPriceMaps.get(card) ?? {};
      if (prices[period] !== undefined) return prices[period];
      if (card.dataset.hasFree === 'true') return 0;
      return null;
    };

    const sortProductFamilies = (families, period, direction) => {
      return [...families].sort((first, second) => {
        const familyPrice = (familyId) => {
          const visibleCards = (productFamilies.get(familyId) ?? []).filter((card) => !card.hidden);
          const values = visibleCards.map((card) => readPeriodPrice(card, period)).filter((value) => value !== null);
          if (!values.length) return null;
          return direction === 1 ? Math.min(...values) : Math.max(...values);
        };
        const firstPrice = familyPrice(first.dataset.productFamily);
        const secondPrice = familyPrice(second.dataset.productFamily);
        if (firstPrice === null || secondPrice === null) {
          if (firstPrice !== secondPrice) return firstPrice === null ? 1 : -1;
          return Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder);
        }
        return (firstPrice - secondPrice) * direction
          || Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder);
      });
    };

    const renderCatalog = () => {
      const productsActive = activeMode.value === 'products';
      const query = normalise(searchInput?.value ?? '');
      const controls = currentControls();
      const selectedCategory = controls.category?.value ?? 'all';
      const selectedPrice = controls.price?.value ?? 'any';
      const selectedPremium = controls.premium?.value ?? 'all';
      const period = controls.period?.value ?? (productsActive ? 'monthly' : 'starting');
      const sortDirection = controls.sort?.value === 'price-asc' ? 1
        : controls.sort?.value === 'price-desc' ? -1 : 0;
      let matchingCount = 0;

      if (productsActive) {
        const visibleFamilies = [];
        familyPanels.forEach(({ panel, family, cardsGrid }) => {
          const familyMatches = normalise(family.title).includes(query) && query !== '';
          let visibleChildren = 0;
          (productFamilies.get(family.id) ?? []).forEach((card) => {
            const name = normalise(card.dataset.name ?? card.querySelector('h3')?.textContent ?? '');
            const planText = normalise(card.querySelector('.plan-list')?.textContent ?? '');
            const matchesSearch = !query || familyMatches || name.includes(query) || planText.includes(query);
            const matchesCategory = selectedCategory === 'all' || family.id === selectedCategory;
            const matchesPremium = selectedPremium !== 'premium' || family.premium === true;
            const matchesPrice = selectedPrice === 'any'
              || (selectedPrice === 'free' && card.dataset.hasFree === 'true')
              || (selectedPrice === 'paid' && card.dataset.hasPaid === 'true');
            card.hidden = !(matchesSearch && matchesCategory && matchesPremium && matchesPrice);
            if (!card.hidden) visibleChildren += 1;
          });
          panel.hidden = visibleChildren === 0;
          if (!panel.hidden) {
            matchingCount += visibleChildren;
            visibleFamilies.push(panel);
          }
          const cards = productFamilies.get(family.id) ?? [];
          const visibleCards = cards.filter((card) => !card.hidden);
          if (sortDirection && visibleCards.length > 1) {
            const sorted = [...visibleCards].sort((first, second) => {
              const firstPrice = readPeriodPrice(first, period);
              const secondPrice = readPeriodPrice(second, period);
              if (firstPrice === null || secondPrice === null) {
                if (firstPrice !== secondPrice) return firstPrice === null ? 1 : -1;
                return Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder);
              }
              return (firstPrice - secondPrice) * sortDirection
                || Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder);
            });
            sorted.forEach((card) => cardsGrid.appendChild(card));
          } else if (!sortDirection) {
            [...cards]
              .sort((first, second) => Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder))
              .forEach((card) => cardsGrid.appendChild(card));
          }
        });
        if (sortDirection && visibleFamilies.length > 1) {
          sortProductFamilies(visibleFamilies, period, sortDirection).forEach((panel) => familyContainer.appendChild(panel));
        } else {
          visibleFamilies.sort((first, second) => Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder))
            .forEach((panel) => familyContainer.appendChild(panel));
        }
      } else {
        const serviceCategoryText = new Map(serviceCategoryData.map(({ id, title }) => [id, normalise(title)]));
        const visibleCategories = [];
        serviceCategories.forEach((category) => {
          const categoryId = category.dataset.serviceCategory;
          const categoryText = serviceCategoryText.get(categoryId) ?? '';
          const categoryMatches = Boolean(query && categoryText.includes(query));
          const categorySelected = selectedCategory === 'all' || categoryId === selectedCategory;
          const list = category.querySelector('.service-list');
          const items = Array.from(list?.querySelectorAll('.catalog-item') ?? []);
          items.forEach((item) => {
            const name = normalise(item.dataset.name ?? item.textContent ?? '');
            const matchesSearch = !query || categoryMatches || name.includes(query);
            item.hidden = !(categorySelected && matchesSearch);
          });
          const visibleItems = items.filter((item) => !item.hidden);
          category.hidden = visibleItems.length === 0;
          if (!category.hidden) {
            matchingCount += visibleItems.length;
            visibleCategories.push(category);
          }
          if (sortDirection && visibleItems.length > 1) {
            const sortableItems = visibleItems.filter((item) => (
              item.dataset.servicePeriod === period
              && Number.isFinite(Number(item.dataset.priceNumber))
            ));
            const unsortedItems = visibleItems.filter((item) => !sortableItems.includes(item));
            unsortedItems.sort((first, second) => (
              Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder)
            ));
            sortableItems.sort((first, second) => (
              (Number(first.dataset.priceNumber) - Number(second.dataset.priceNumber)) * sortDirection
              || Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder)
            ));
            [...sortableItems, ...unsortedItems].forEach((item) => list.appendChild(item));
          } else if (!sortDirection) {
            items
              .sort((first, second) => Number(first.dataset.originalOrder) - Number(second.dataset.originalOrder))
              .forEach((item) => list.appendChild(item));
          }
        });
        if (sortDirection) {
          visibleCategories.sort((first, second) => {
            const getCategoryPrice = (category) => {
              const prices = Array.from(category.querySelectorAll('.catalog-item:not([hidden])'))
                .filter((item) => item.dataset.servicePeriod === period)
                .map((item) => Number(item.dataset.priceNumber))
                .filter(Number.isFinite);
            if (!prices.length) return Number.POSITIVE_INFINITY;
            return sortDirection === 1 ? Math.min(...prices) : Math.max(...prices);
            };
            const firstPrice = getCategoryPrice(first);
            const secondPrice = getCategoryPrice(second);
            if (!Number.isFinite(firstPrice) || !Number.isFinite(secondPrice)) {
              if (firstPrice !== secondPrice) return Number.isFinite(firstPrice) ? -1 : 1;
              return serviceCategories.indexOf(first) - serviceCategories.indexOf(second);
            }
            return (firstPrice - secondPrice) * sortDirection
              || serviceCategories.indexOf(first) - serviceCategories.indexOf(second);
          });
          visibleCategories.forEach((category) => serviceGroup.appendChild(category));
        } else {
          serviceCategories.filter((category) => !category.hidden).forEach((category) => serviceGroup.appendChild(category));
        }
      }

      if (resultCount) resultCount.textContent = `${matchingCount} ${matchingCount === 1 ? 'result' : 'results'}`;
      if (emptyState) emptyState.hidden = matchingCount !== 0;
    };

    if (
      form instanceof HTMLFormElement
      && searchInput instanceof HTMLInputElement
      && productCategory instanceof HTMLSelectElement
      && serviceCategory instanceof HTMLSelectElement
      && premiumFilter instanceof HTMLSelectElement
      && productPriceFilter instanceof HTMLSelectElement
      && pricePeriod instanceof HTMLSelectElement
      && sortSelect instanceof HTMLSelectElement
      && productGroup
      && serviceGroup
      && resultCount
      && emptyState
    ) {
      modeButtons.forEach((button) => {
        button.addEventListener('click', () => setMode(button.dataset.catalogMode));
        button.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const nextMode = event.key === 'Home' ? 'products'
            : event.key === 'End' ? 'services'
              : button.dataset.catalogMode === 'products' ? 'services' : 'products';
          setMode(nextMode);
          servicesCatalog.querySelector(`[data-catalog-mode="${nextMode}"]`)?.focus();
        });
      });

      form.addEventListener('input', () => {
        saveCurrentState();
        renderCatalog();
      });
      form.addEventListener('change', () => {
        saveCurrentState();
        renderCatalog();
      });
      form.addEventListener('reset', (event) => {
        event.preventDefault();
        const state = savedState[activeMode.value];
        state.search = '';
        state.category = 'all';
        if (activeMode.value === 'products') state.price = 'any';
        state.period = activeMode.value === 'products' ? 'monthly' : 'starting';
        state.sort = 'default';
        state.premium = 'all';
        if (searchInput) searchInput.value = '';
        if (activeMode.value === 'products') {
          productCategory.value = 'all';
          productPriceFilter.value = 'any';
          premiumFilter.value = 'all';
        } else {
          serviceCategory.value = 'all';
        }
        pricePeriod.value = state.period;
        sortSelect.value = 'default';
        renderCatalog();
      });

      const selectedProductMode = modeButtons.find((button) => button.getAttribute('aria-selected') === 'true')
        ?.dataset.catalogMode ?? 'products';
      activeMode.value = selectedProductMode === 'services' ? 'products' : 'services';
      setMode(selectedProductMode, false);
    }
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href === currentPage) {
      link.classList.add('active');
    }
  });

  document.querySelectorAll('.faq-item').forEach((item) => {
    const button = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!button || !answer) return;
    button.setAttribute('aria-expanded', String(item.classList.contains('open')));
    if (!item.classList.contains('open')) answer.hidden = true;
    button.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
      answer.hidden = isOpen;
    });
  });

  const orderModal = (() => {
    const existing = document.getElementById('mi-cortex-order-modal');
    if (existing) return existing;
    const modal = document.createElement('div');
    modal.id = 'mi-cortex-order-modal';
    modal.className = 'order-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="order-modal__backdrop" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
        <div class="order-modal__header">
          <h2 id="order-modal-title">Order request</h2>
          <button type="button" class="order-modal__close" aria-label="Close order form">×</button>
        </div>
        <div class="order-modal__body">
          <div class="order-modal__step is-visible" data-order-step="confirm">
            <p class="order-modal__summary"><strong data-order-name>Item</strong><br /><span data-order-meta>Product request</span></p>
            <p>Review the item and continue to the customer details form to send your order request.</p>
            <div class="order-modal__actions">
              <button type="button" class="order-modal__button--ghost" data-order-cancel>Cancel</button>
              <button type="button" class="order-modal__button" data-order-continue>Continue</button>
            </div>
          </div>
          <div class="order-modal__step" data-order-step="form">
            <form class="order-form" data-order-form>
              <div class="order-form__grid">
                <div class="order-form__field">
                  <label for="order-customer-name">Customer name</label>
                  <input id="order-customer-name" name="customerName" type="text" required />
                </div>
                <div class="order-form__field">
                  <label for="order-customer-email">Email</label>
                  <input id="order-customer-email" name="customerEmail" type="email" required />
                </div>
                <div class="order-form__field">
                  <label for="order-customer-phone">Phone</label>
                  <input id="order-customer-phone" name="customerPhone" type="tel" required />
                </div>
                <div class="order-form__field">
                  <label for="order-company-name">Company / organisation</label>
                  <input id="order-company-name" name="companyName" type="text" />
                </div>
                <div class="order-form__field">
                  <label for="order-quantity">Quantity</label>
                  <input id="order-quantity" name="quantity" type="number" min="1" max="9999" value="1" required />
                </div>
                <div class="order-form__field">
                  <label for="order-urgency">Urgency</label>
                  <select id="order-urgency" name="urgency">
                    <option value="standard">Standard</option>
                    <option value="priority">Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div class="order-form__field">
                  <label for="order-preferred-timeline">Preferred timeline</label>
                  <input id="order-preferred-timeline" name="preferredTimeline" type="text" placeholder="e.g. 2 weeks" />
                </div>
                <div class="order-form__field">
                  <label for="order-budget">Budget</label>
                  <input id="order-budget" name="budget" type="text" placeholder="e.g. Rs. 50,000" />
                </div>
              </div>
              <div class="order-form__field">
                <label for="order-notes">Order notes</label>
                <textarea id="order-notes" name="notes" placeholder="Share specific requirements or scope notes."></textarea>
              </div>
              <p class="order-modal__notice" aria-live="polite"></p>
              <div class="order-modal__actions">
                <button type="button" class="order-modal__button--ghost" data-order-back>Back</button>
                <button type="submit" class="order-modal__button">Submit order request</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const closeButton = modal.querySelector('.order-modal__close');
    const cancelButton = modal.querySelector('[data-order-cancel]');
    const backButton = modal.querySelector('[data-order-back]');
    const continueButton = modal.querySelector('[data-order-continue]');
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      modal.querySelector('[data-order-step="confirm"]').classList.add('is-visible');
      modal.querySelector('[data-order-step="form"]').classList.remove('is-visible');
      modal.querySelector('[data-order-form]').reset();
      modal.querySelector('[data-order-name]').textContent = 'Item';
      modal.querySelector('[data-order-meta]').textContent = 'Product request';
      modal.querySelector('.order-modal__notice').textContent = '';
      modal.dataset.itemName = '';
      modal.dataset.itemType = '';
      modal.dataset.itemCategory = '';
    };
    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    backButton.addEventListener('click', () => {
      modal.querySelector('[data-order-step="confirm"]').classList.add('is-visible');
      modal.querySelector('[data-order-step="form"]').classList.remove('is-visible');
      modal.querySelector('.order-modal__notice').textContent = '';
    });
    continueButton.addEventListener('click', () => {
      modal.querySelector('[data-order-step="confirm"]').classList.remove('is-visible');
      modal.querySelector('[data-order-step="form"]').classList.add('is-visible');
      const customerName = modal.querySelector('#order-customer-name');
      if (customerName) customerName.focus();
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    modal.querySelector('[data-order-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const notice = modal.querySelector('.order-modal__notice');
      const submitButton = form.querySelector('button[type="submit"]');
      const payload = {
        itemType: modal.dataset.itemType || 'product',
        itemName: modal.dataset.itemName || 'Product request',
        itemCategory: modal.dataset.itemCategory || '',
        customerName: form.elements.customerName.value.trim(),
        customerEmail: form.elements.customerEmail.value.trim(),
        customerPhone: form.elements.customerPhone.value.trim(),
        companyName: form.elements.companyName.value.trim(),
        quantity: Number(form.elements.quantity.value || 1),
        urgency: form.elements.urgency.value,
        preferredTimeline: form.elements.preferredTimeline.value.trim(),
        budget: form.elements.budget.value.trim(),
        notes: form.elements.notes.value.trim()
      };
      notice.textContent = '';
      notice.classList.remove('order-modal__notice--error');
      submitButton.disabled = true;
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || 'The order request could not be submitted.');
        }
        notice.textContent = `Order request received. Reference: ${result.id || 'pending'}`;
        notice.classList.remove('order-modal__notice--error');
        form.reset();
        setTimeout(close, 1800);
      } catch (error) {
        notice.textContent = error.message || 'The order request could not be submitted.';
        notice.classList.add('order-modal__notice--error');
      } finally {
        submitButton.disabled = false;
      }
    });
    return modal;
  })();

  const attachOrderButtons = () => {
    const items = Array.from(document.querySelectorAll('.catalog-item'));
    items.forEach((item) => {
      if (item.querySelector('.catalog-item__order')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'catalog-item__order';
      button.textContent = 'Order now';
      button.addEventListener('click', () => {
        const itemName = item.dataset.name || item.querySelector('h3')?.textContent?.trim() || 'Selected item';
        const itemCategory = item.dataset.category || 'products';
        const itemType = (
          item.closest('[data-group="services"]') || item.dataset.category === 'services'
        ) ? 'service' : 'product';
        const nameLabel = orderModal.querySelector('[data-order-name]');
        const metaLabel = orderModal.querySelector('[data-order-meta]');
        nameLabel.textContent = itemName;
        metaLabel.textContent = `${itemType === 'service' ? 'Service' : 'Product'} request · ${itemCategory === 'services' ? 'Service category' : 'Product category'}`;
        orderModal.dataset.itemName = itemName;
        orderModal.dataset.itemType = itemType;
        orderModal.dataset.itemCategory = itemCategory;
        orderModal.classList.add('is-open');
        orderModal.setAttribute('aria-hidden', 'false');
      });
      item.appendChild(button);
    });
  };

  if (document.querySelector('.services-catalog')) {
    attachOrderButtons();
  }

  const ordersTable = document.querySelector('[data-admin-orders-list]');
  if (ordersTable) {
    const formatStatus = (value) => value ? value.replace(/_/g, ' ') : 'new';
    const renderOrders = (orders) => {
      if (!orders.length) {
        ordersTable.innerHTML = '<p class="admin-orders-table__empty">No product or service orders have been submitted yet.</p>';
        return;
      }
      ordersTable.innerHTML = `
        <table class="admin-orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((order) => `
              <tr>
                <td><strong>${order.id.slice(0, 8)}</strong><br /><small>${new Date(order.createdAt).toLocaleString()}</small></td>
                <td>${order.customerName}<br /><small>${order.customerEmail}</small></td>
                <td><strong>${order.itemName}</strong><br /><small>${order.itemType}</small></td>
                <td>${order.quantity}</td>
                <td><span class="admin-orders-table__status">${formatStatus(order.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    };
    fetch('/api/site-admin/orders', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The order list request failed.');
      renderOrders(result.orders || []);
    }).catch(() => {
      ordersTable.innerHTML = '<p class="admin-orders-table__empty">The order list is temporarily unavailable.</p>';
    });
  }

  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        loadingScreen.classList.add('hidden');
      }, 450);
    });
  }

  const searchTrigger = document.getElementById('search-trigger');
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('site-search-input');
  const searchResults = document.getElementById('site-search-results');

  const siteSearchData = [
    { title: 'Home', url: 'index.html', description: 'MI CORTEX X INC. homepage, overview, values and services' },
    { title: 'About Us', url: 'about.html', description: 'Company background, founder, vision and company story' },
    { title: 'Company History', url: 'company-history.html', description: 'Confirmed company timeline and future milestones' },
    { title: 'Our Vision & Mission', url: 'vision-mission.html', description: 'Vision, mission and corporate values' },
    { title: 'Leadership', url: 'leadership.html', description: 'Founder and executive leadership overview' },
    { title: 'Company Divisions', url: 'departments.html', description: 'Company divisions and operating areas' },
    { title: 'Services', url: 'services.html', description: 'AI, software, web, UX, cloud and technology solutions' },
    { title: 'Products & Projects', url: 'projects.html', description: 'Confirmed active projects and portfolio overview' },
    { title: 'Portfolio', url: 'portfolio.html', description: 'Company portfolio and highlights' },
    { title: 'Achievements', url: 'achievements.html', description: 'Past and planned achievements, with verification notes' },
    { title: 'News & Updates', url: 'news.html', description: 'Company updates and announcements' },
    { title: 'Careers', url: 'careers.html', description: 'Career categories, age requirement and applications calendar' },
    { title: 'Contact Us', url: 'contact.html', description: 'Contact options, WhatsApp, Telegram and inquiry form' },
    { title: 'FAQ', url: 'faq.html', description: 'Frequently asked questions and company information' },
    { title: 'Privacy Policy', url: 'privacy.html', description: 'Website privacy policy and customer data handling' },
    { title: 'Terms & Conditions', url: 'terms.html', description: 'Website use, scope and legal terms' },
    { title: 'Sub-Companies', url: 'sub-companies.html', description: 'Overview of proposed future business brands' },
    { title: 'Project: CORTEX CORE AI', url: 'project-cortex-core-ai.html', description: 'Artificial intelligence platform details' },
    { title: 'Project: CANVA PRO', url: 'project-canva-pro.html', description: 'Digital access platform details' },
    { title: 'Project: AUTO-CARD-MARKING', url: 'project-auto-card-marking.html', description: 'Monthly payment management system details' },
    { title: 'Project: සිහිනයට කෝටියක්', url: 'project-sihinaya-kotiya.html', description: 'Online quiz project details and programme channels' },
    { title: 'Sub-Company: MI CORTEX HARDTECH', url: 'sub-company-hardtech.html', description: 'Proposed future hardware engineering brand' },
    { title: 'Sub-Company: MI CORTEX CODEX', url: 'sub-company-codex.html', description: 'Proposed future software development brand' },
    { title: 'Sub-Company: MI CORTEX ROBOTECH', url: 'sub-company-robotech.html', description: 'Proposed future robotics engineering brand' },
    { title: 'Sub-Company: MI CORTEX AITECH', url: 'sub-company-aitech.html', description: 'Proposed future AI and machine learning brand' },
    { title: 'Sub-Company: MI CORTEX CYBERTECH', url: 'sub-company-cybertech.html', description: 'Proposed future cybersecurity brand' },
    { title: 'Sub-Company: MI CORTEX ELECTROTECH', url: 'sub-company-electrotech.html', description: 'Proposed future electronics and embedded systems brand' },
    { title: 'Sub-Company: MI CORTEX AEROTECH', url: 'sub-company-aerotech.html', description: 'Proposed future aerospace and aviation technology brand' },
    { title: 'Sub-Company: MI CORTEX EDUTECH', url: 'sub-company-edutech.html', description: 'Proposed future education technology brand' },
    { title: 'Sub-Company: MI CORTEX DIGITECH', url: 'sub-company-digittech.html', description: 'Proposed future digital products and online services brand' },
    { title: 'Sub-Company: MI CORTEX INNOVATION', url: 'sub-company-innovation.html', description: 'Proposed future innovation and research brand' },
    { title: 'Sub-Company: MI CORTEX AUTOTECH', url: 'sub-company-autotech.html', description: 'Proposed future automotive technology brand' }
  ];

  const renderSearchResults = (query) => {
    if (!searchResults) return;
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      searchResults.innerHTML = '<div class="empty-state">Type a keyword to find company services, projects, departments or sub-company pages.</div>';
      return;
    }

    const matches = siteSearchData.filter((item) => {
      const hay = `${item.title} ${item.description} ${item.url}`.toLowerCase();
      return hay.includes(normalized);
    });

    if (!matches.length) {
      searchResults.innerHTML = '<div class="empty-state">No public pages matched your search. Try “AI”, “services”, “careers”, or “sub-company”.</div>';
      return;
    }

    searchResults.innerHTML = matches.slice(0, 12).map((item) => `
      <a class="search-result-item" href="${item.url}">
        <strong>${item.title}</strong>
        <small>${item.description}</small>
      </a>
    `).join('');
  };

  if (searchTrigger && searchModal && searchResults && searchInput) {
    searchTrigger.addEventListener('click', () => {
      searchModal.classList.add('open');
      searchInput.value = '';
      renderSearchResults('');
      setTimeout(() => searchInput.focus(), 50);
    });

    const closeModal = () => searchModal.classList.remove('open');
    searchModal.addEventListener('click', (event) => {
      if (event.target === searchModal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && searchModal.classList.contains('open')) {
        closeModal();
      }
    });

    searchInput.addEventListener('input', (event) => {
      renderSearchResults(event.target.value);
    });
  }

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const honeypot = form.querySelector('[name="website"]');
      if (honeypot && honeypot.value) {
        event.preventDefault();
        return;
      }

      const requiredFields = Array.from(form.querySelectorAll('[required]'));
      const invalid = requiredFields.some((el) => !el.value.trim());
      if (invalid) {
        event.preventDefault();
        const msg = document.createElement('p');
        msg.className = 'notice';
        msg.textContent = 'Please complete all required fields before submitting this form.';
        const existing = form.querySelector('.form-message');
        if (existing) existing.remove();
        msg.classList.add('form-message');
        form.appendChild(msg);
        return;
      }

      event.preventDefault();
      const message = document.createElement('p');
      message.className = 'notice form-message';
      message.textContent = 'This is a frontend-only demo form. Production submission requires a secure backend, database, and email delivery configuration.';
      const before = form.querySelector('.form-message');
      if (before) before.remove();
      form.appendChild(message);
    });
  });

  updateLanguageUI();
  document.querySelectorAll('[data-lang-toggle]').forEach((button) => {
    const active = button.dataset.langToggle === body.dataset.language;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
});
