/*==================== MENU SHOW Y HIDDEN ====================*/

const navMenu = document.getElementById('nav-menu'),
        navToggle = document.getElementById('nav-toggle'),
        navClose = document.getElementById('nav-close')

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle){
        navToggle.addEventListener('click', () =>{
            navMenu.classList.add('show-menu')
            navToggle.setAttribute('aria-expanded', 'true')
        })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if(navClose){
        navClose.addEventListener('click', () =>{
            navMenu.classList.remove('show-menu')
            if (navToggle) navToggle.setAttribute('aria-expanded', 'false')
        })
}

/*==================== REMOVE MENU MOBILE ====================*/

const navLink = document.querySelectorAll('.nav__link')

function linkAction(){
    const navMenu = document.getElementById('nav-menu')
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show-menu')
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*==================== KEYBOARD ACTIVATION FOR ICON CONTROLS ====================*/
/* The nav toggle, nav close and theme switch are icon elements rather than real
   buttons. They are exposed as role="button" in the markup, so Enter and Space
   must activate them the same way a click does. */
function enableKeyboardActivation(element){
    if (!element) return
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
            event.preventDefault()
            element.click()
        }
    })
}

enableKeyboardActivation(navToggle)
enableKeyboardActivation(navClose)

/*==================== GENERIC TABS FUNCTION ====================*/
/* A tab's data-target is a selector matched against the content elements, so one tab
   can show several of them. Tabs marked aria-disabled="true" are skipped, by click and
   by arrow key. onChange runs after a tab is selected. Returns the select function. */
function setupTabs(buttonSelector, contentSelector, activeClass, onChange) {
    const tabs = Array.from(document.querySelectorAll(buttonSelector));
    const contents = Array.from(document.querySelectorAll(contentSelector));
    const isDisabled = (tab) => tab.getAttribute('aria-disabled') === 'true';

    const activate = (tab) => {
        if (isDisabled(tab)) return;
        const targets = contents.filter(c => c.matches(tab.dataset.target));
        if (!targets.length) return;

        contents.forEach(c => c.classList.remove(activeClass));
        targets.forEach(t => t.classList.add(activeClass));

        tabs.forEach(t => {
            t.classList.remove(activeClass);
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
        });
        tab.classList.add(activeClass);
        tab.setAttribute('aria-selected', 'true');
        tab.setAttribute('tabindex', '0');

        if (onChange) onChange(tab);
    };

    tabs.forEach((tab) =>{
        tab.addEventListener('click', () => activate(tab));

        // Roving-tabindex keyboard support expected of a tablist
        tab.addEventListener('keydown', (event) => {
            const enabled = tabs.filter(t => !isDisabled(t));
            const index = enabled.indexOf(tab);
            let next = null;

            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = enabled[(index + 1) % enabled.length];
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = enabled[(index - 1 + enabled.length) % enabled.length];
            else if (event.key === 'Home') next = enabled[0];
            else if (event.key === 'End') next = enabled[enabled.length - 1];
            else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
                event.preventDefault();
                activate(tab);
                return;
            }

            if (next){
                event.preventDefault();
                activate(next);
                next.focus();
            }
        });
    });

    return activate;
}

// History tabs
setupTabs('.history__button[data-target]', '.history__content[data-content]', 'history__active');

/*==================== PUBLICATIONS TABS ====================*/
/* Two tablists: the view (All / Traditional) and the category within it (Research /
   Outreach / Acknowledgements). A category tab shows that category's group in every
   view, and is disabled while the open view has no such group — Traditional lists
   research only. If a view change disables the selected category, the first one still
   available is selected instead. */
const categoryTabs = Array.from(document.querySelectorAll('.publications__category[data-target]'));
const selectCategory = setupTabs('.publications__category[data-target]', '.publications__group', 'publications__active');

function syncCategoriesToView(viewTab) {
    const view = document.querySelector(viewTab.dataset.target);
    if (!view) return;

    categoryTabs.forEach(tab => {
        tab.setAttribute('aria-disabled', String(!view.querySelector(tab.dataset.target)));
    });

    const selected = categoryTabs.find(tab => tab.classList.contains('publications__active'));
    if (selected && selected.getAttribute('aria-disabled') === 'true') {
        const fallback = categoryTabs.find(tab => tab.getAttribute('aria-disabled') !== 'true');
        if (fallback) selectCategory(fallback);
    }
}

setupTabs('.publications__subset[data-target]', '.publications__content[data-content]', 'publications__active',
    syncCategoriesToView);

const initialView = document.querySelector('.publications__subset.publications__active[data-target]');
if (initialView) syncCategoriesToView(initialView);


/*==================== PUBLICATIONS MODAL ====================*/
/* Only the cards inside the "All" panel carry a .publications__modal. Scoping the
   trigger query to #all keeps the trigger list and the modal list the same length
   and in the same order — an unscoped '.publications__content .publications__content'
   also matches the Traditional list, whose entries have no modal, so clicking one
   used to index past the end of modalViews and throw. */
const modalViews = document.querySelectorAll('#all .publications__modal');
const modalBtns = document.querySelectorAll('#all .publications__container > .publications__content');
const modalCloses = document.querySelectorAll('.publications__modal-close');

/* Each modal is authored inside the card that opens it, and that card is exposed as
   role="button". A button's descendants are presentational, which would prune the
   whole modal — title, abstract and DOI links — out of the accessibility tree. Lifting
   the modals onto <body> takes them out of that subtree.
   Visually inert: .publications__modal is position:fixed with all four insets at 0, it
   is not a flex/grid item of the card, and no rule styles it or its contents by
   ancestry. modalViews is a static NodeList, so moving the nodes neither disturbs it
   nor the index pairing with modalBtns, and listeners survive the move. */
modalViews.forEach(mv => document.body.appendChild(mv));

// Remembers what to return focus to once the modal closes
let publicationTrigger = null;

let openModal = function(modalClick) {
    const modal = modalViews[modalClick];
    if (!modal) return;

    modalViews.forEach(mv => mv.classList.remove('active-modal')); // close others
    modal.classList.add('active-modal');
    modal.setAttribute('aria-hidden', 'false');

    const closeBtn = modal.querySelector('.publications__modal-close');
    if (closeBtn) closeBtn.focus();

    history.pushState({ modalOpen: true, modalIndex: modalClick }, '', `#publication-modal-${modalClick}`);
};

let closeAllModals = function() {
    modalViews.forEach(mv => {
        mv.classList.remove('active-modal');
        mv.setAttribute('aria-hidden', 'true');
    });

    if (publicationTrigger) {
        publicationTrigger.focus();
        publicationTrigger = null;
    }
};

// True when any publications modal is currently on screen
const isPublicationModalOpen = () => Array.from(modalViews).some(mv => mv.classList.contains('active-modal'));

const dismissPublicationModal = function() {
    if (history.state && history.state.modalOpen) {
        history.back();
    } else {
        closeAllModals();
    }
};

modalBtns.forEach((btn, i) => {
    btn.addEventListener('click', (event) => {
        // Clicks that originate inside the open modal (links, the close icon,
        // the body text) must not bubble back out and re-open the card.
        if (event.target.closest('.publications__modal')) return;

        publicationTrigger = btn;
        openModal(i);
    });

    // The cards are divs, so expose them as buttons and honour Enter/Space
    btn.addEventListener('keydown', (event) => {
        if (event.target !== btn) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
            event.preventDefault();
            publicationTrigger = btn;
            openModal(i);
        }
    });
});

modalCloses.forEach(closeBtn => {
    closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        dismissPublicationModal();
    });

    closeBtn.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
            event.preventDefault();
            event.stopPropagation();
            dismissPublicationModal();
        }
    });
});

// Close modal when clicking on the overlay
modalViews.forEach(modalView => {
    modalView.addEventListener('click', (event) => {
        // Check if the click is on the overlay (modalView) itself
        if (event.target === modalView) {
            event.stopPropagation();
            dismissPublicationModal();
        }
    });
});

window.addEventListener('popstate', () => {
    closeAllModals();
});


/*==================== HIGHLIGHTS SWIPER  ====================*/
const highlightSwiperOptions = {
  cssMode: true,
  loop: true,

  // Selector strings resolve to the arrows/dots inside each carousel's own container
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
};

/*===== NEWS: THREE CARDS PER SLIDE ON PHONES =====*/
/* News slides are authored as grids of six cards. On phones that grid is a single
   column, so a slide was six cards tall; there each slide is split into slides of
   three. The authored slides and their cards are captured before Swiper runs, since
   loop mode clones slides, and the split is redone when the viewport crosses the
   breakpoint. */
const newsContainer = document.querySelector('#news .highlight__container');
const newsWrapper = newsContainer && newsContainer.querySelector('.swiper-wrapper');
const newsSlides = newsWrapper ? Array.from(newsWrapper.children) : [];
const newsSlideCards = newsSlides.map(slide => Array.from(slide.querySelectorAll('.highlight__item')));
// The exact complement of the CSS breakpoint where the news grid gains a second column
const phoneQuery = window.matchMedia('not all and (min-width: 568px)');

function layoutNewsSlides(cardsPerSlide) {
    const slides = [];
    newsSlides.forEach((slide, i) => {
        const cards = newsSlideCards[i];
        for (let start = 0; start < cards.length; start += cardsPerSlide) {
            // The first group goes back into the authored slide; any further groups get
            // an empty copy of it, so the slide and grid classes stay as authored
            const target = start === 0 ? slide : slide.cloneNode(false);
            const grid = start === 0
                ? slide.querySelector('.highlight__grid')
                : target.appendChild(slide.querySelector('.highlight__grid').cloneNode(false));
            grid.append(...cards.slice(start, start + cardsPerSlide));
            slides.push(target);
        }
    });
    newsWrapper.replaceChildren(...slides);
}

const newsCardsPerSlide = () => (phoneQuery.matches ? 3 : Infinity);

if (newsWrapper) layoutNewsSlides(newsCardsPerSlide());

// One instance per carousel (News and Media)
document.querySelectorAll('.highlight__container')
    .forEach(container => new Swiper(container, highlightSwiperOptions));

const onPhoneBreakpoint = () => {
    if (!newsWrapper) return;
    // destroy() also removes loop mode's cloned slides before the cards are regrouped
    newsContainer.swiper.destroy(true, true);
    layoutNewsSlides(newsCardsPerSlide());
    new Swiper(newsContainer, highlightSwiperOptions);
};

if (phoneQuery.addEventListener) phoneQuery.addEventListener('change', onPhoneBreakpoint);
else if (phoneQuery.addListener) phoneQuery.addListener(onPhoneBreakpoint);

/*==================== HIGHLIGHTS MODAL ====================*/

const masterModal = document.getElementById('master-highlight-modal');
const masterModalContent = document.getElementById('master-modal-content');

// Remembers which card opened the modal so focus can be handed back
let highlightTrigger = null;

const isHighlightModalOpen = () => !!masterModal && masterModal.classList.contains('active-modal');

let closeHighlightModal = function() {
    if (masterModal) {
        masterModal.classList.remove('active-modal');
        masterModal.setAttribute('aria-hidden', 'true');
        // Clear the inner HTML so embedded videos stop playing in the background
        masterModalContent.innerHTML = '';
    }

    if (highlightTrigger) {
        highlightTrigger.focus();
        highlightTrigger = null;
    }
};

let openHighlightModal = function(item) {
    const template = item.querySelector('.modal-template');

    if (!template || !masterModal || !masterModalContent) return;

    // Copy the HTML from the specific item's template into the master modal.
    // Replacing innerHTML discards the previous close button along with its
    // listener, so a fresh one is wired up each time.
    masterModalContent.innerHTML = template.innerHTML;
    masterModal.classList.add('active-modal');
    masterModal.setAttribute('aria-hidden', 'false');
    highlightTrigger = item;

    // Label the dialog with whichever heading the template supplied
    const modalTitle = masterModalContent.querySelector('.highlight__modal-title');
    if (modalTitle) {
        modalTitle.id = 'highlight-modal-title';
        masterModal.setAttribute('aria-labelledby', 'highlight-modal-title');
    } else {
        masterModal.removeAttribute('aria-labelledby');
    }

    // Attach a click listener to the newly created close button
    const closeBtn = masterModalContent.querySelector('.highlight__modal-close');
    if (closeBtn) {
        closeBtn.setAttribute('role', 'button');
        closeBtn.setAttribute('tabindex', '0');
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.addEventListener('click', closeHighlightModal);
        closeBtn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
                event.preventDefault();
                closeHighlightModal();
            }
        });
        closeBtn.focus();
    }
};

/* Delegated rather than bound per card: Swiper's loop mode clones slides (and clones
   do not carry listeners), and the News cards are regrouped at the phone breakpoint. */
document.addEventListener('click', (event) => {
    const item = event.target.closest('.highlight__item');
    if (item) openHighlightModal(item);
});

// The cards are divs exposed as role="button", so Enter/Space must work too
document.addEventListener('keydown', (event) => {
    const item = event.target;
    if (!(item instanceof Element) || !item.matches('.highlight__item')) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
        event.preventDefault();
        openHighlightModal(item);
    }
});

// Close on background click
if (masterModal) {
    masterModal.addEventListener('click', (e) => {
        if (e.target === masterModal) {
            closeHighlightModal();
        }
    });
}

/*==================== ESCAPE CLOSES WHICHEVER MODAL IS OPEN ====================*/
/* A single handler avoids the two former listeners racing each other: the
   highlight modal used to be closed by one while the other independently
   called history.back() for a publications modal that was not even open. */
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (isHighlightModalOpen()) {
        closeHighlightModal();
    } else if (isPublicationModalOpen()) {
        dismissPublicationModal();
    }
});

/*==================== SCROLL HANDLERS ====================*/
/* Every scroll-driven update runs from one rAF-batched listener. Previously four
   separate scroll listeners fired on every scroll event, and the progress bar read
   scrollHeight each time, forcing a synchronous layout on each one. */
const sections = document.querySelectorAll('section[id]')
const header = document.getElementById('header')
const scrollUpButton = document.getElementById('scroll-up')
const scrollProgress = document.getElementById('scroll-progress')

/* Pre-resolve each section's nav link once. Sections without a matching link are
   simply skipped, rather than throwing on every scroll event. */
const sectionLinks = Array.from(sections).map(section => ({
    section,
    link: document.querySelector(`.nav__menu a[href="#${section.id}"]`)
}))

function scrollActive(scrollY){
    sectionLinks.forEach(({ section, link }) =>{
        if (!link) return

        const sectionHeight = section.offsetHeight
        const sectionTop = section.offsetTop - 50

        if(scrollY > sectionTop && scrollY <= sectionTop + sectionHeight){
            link.classList.add('active-link')
        }else{
            link.classList.remove('active-link')
        }
    })
}

/*==================== CHANGE BACKGROUND HEADER ====================*/
function scrollHeader(scrollY){
    // When the scroll is greater than 80 viewport height, add the scroll-header class to the header tag
    if (!header) return
    if(scrollY >= 80) header.classList.add('scroll-header'); else header.classList.remove('scroll-header')
}

/*==================== SHOW SCROLL UP ====================*/
function scrollUp(scrollY){
    // When the scroll is higher than 560 viewport height, add the show-scroll class to the a tag with the scroll-top class
    if (!scrollUpButton) return
    if(scrollY >= 560) scrollUpButton.classList.add('show-scroll'); else scrollUpButton.classList.remove('show-scroll')
}

/*==================== SCROLL PROGRESS BAR ====================*/
function scrollProgressBar(scrollY){
    if (!scrollProgress) return

    // Get the total scrollable height of the page
    const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight

    // Guard against dividing by zero on pages shorter than the viewport
    const scrolled = totalHeight > 0 ? (scrollY / totalHeight) * 100 : 0

    // Update the width of the progress bar
    scrollProgress.style.width = Math.min(scrolled, 100) + '%'
}

let scrollFrame = null

function onScroll(){
    if (scrollFrame !== null) return

    scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null

        const scrollY = window.scrollY || document.documentElement.scrollTop

        scrollActive(scrollY)
        scrollHeader(scrollY)
        scrollUp(scrollY)
        scrollProgressBar(scrollY)
    })
}

window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', onScroll, { passive: true })

// Run once so the initial state matches the position the page loaded at
onScroll()


/*==================== DARK LIGHT THEME ====================*/

const themeButton = document.getElementById('theme-button');
const themeIcon = themeButton && themeButton.querySelector('use');
const researchInterestImage = document.querySelector('.about__researchinterestimg');
const darkTheme = 'dark-theme';

// SVG image files for light and dark themes
const darkResearchInterestImageSrc = 'assets/img/researchinterestdark.svg';
const lightResearchInterestImageSrc = 'assets/img/researchinterest.svg';

/* Storage can throw when the browser blocks it (some private modes, blocked site
   data). The theme still works then; the choice just is not remembered. */
const storedTheme = () => {
    try { return localStorage.getItem('selected-theme'); } catch (e) { return null; }
};
const storeTheme = (theme) => {
    try { localStorage.setItem('selected-theme', theme); } catch (e) { /* not remembered */ }
};

// Check previously selected theme (if any)
const selectedTheme = storedTheme();

// Get current theme
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light';

function applyTheme(theme) {
    const isDark = theme === 'dark';

    document.body.classList[isDark ? 'add' : 'remove'](darkTheme);

    // The <head> bootstrap class has done its job now that body carries the real one
    document.documentElement.classList.remove('dark-theme-preload');

    if (themeButton) {
        // The button shows the icon for the theme it will switch *to*
        if (themeIcon) themeIcon.setAttribute('href', isDark ? '#i-sun' : '#i-moon');
        themeButton.setAttribute('aria-pressed', String(isDark));
        themeButton.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }

    // theme-image is a theme-aware SVG, so only the research diagram needs swapping
    if (researchInterestImage) {
        researchInterestImage.src = isDark ? darkResearchInterestImageSrc : lightResearchInterestImageSrc;
    }

    // Keep the browser UI colour in step with the theme
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isDark ? '#191627' : '#fbfbfe');
    }
}

/* Honour an explicit past choice; otherwise follow the operating system.
   Previously a first-time visitor in dark mode was always served the light theme. */
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(selectedTheme || (prefersDark ? 'dark' : 'light'));

// Follow later OS changes, but only while the visitor has made no explicit choice
if (window.matchMedia) {
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSchemeChange = (event) => {
        if (!storedTheme()) {
            applyTheme(event.matches ? 'dark' : 'light');
        }
    };

    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSchemeChange);
    else if (darkQuery.addListener) darkQuery.addListener(onSchemeChange);
}

// Toggle theme manually with the button
if (themeButton) {
    themeButton.addEventListener('click', () => {
        applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');

        // Save the user's theme choice
        storeTheme(getCurrentTheme());
    });

    enableKeyboardActivation(themeButton);
}
