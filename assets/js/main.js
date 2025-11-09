/*==================== MENU SHOW Y HIDDEN ====================*/

const navMenu = document.getElementById('nav-menu'),
        navToggle = document.getElementById('nav-toggle'),
        navClose = document.getElementById('nav-close')

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle){
        navToggle.addEventListener('click', () =>{
            navMenu.classList.add('show-menu')
        })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if(navClose){
        navClose.addEventListener('click', () =>{
            navMenu.classList.remove('show-menu')
        })
}

/*==================== REMOVE MENU MOBILE ====================*/

const navLink = document.querySelectorAll('.nav__link')

function linkAction(){
    const navMenu = document.getElementById('nav-menu')
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*==================== GENERIC TABS FUNCTION ====================*/
function setupTabs(buttonSelector, contentSelector, activeClass) {
    const tabs = document.querySelectorAll(buttonSelector);
    const contents = document.querySelectorAll(contentSelector);

    tabs.forEach(tab =>{
        tab.addEventListener('click', () =>{
            const target = document.querySelector(tab.dataset.target);

            contents.forEach(c => c.classList.remove(activeClass));
            target.classList.add(activeClass);

            tabs.forEach(t => t.classList.remove(activeClass));
            tab.classList.add(activeClass);
        });
    });
}

// History tabs
setupTabs('.history__button[data-target]', '.history__content[data-content]', 'history__active');

// Publications tabs
setupTabs('.publications__subset[data-target]', '.publications__content[data-content]', 'publications__active');


/*==================== PUBLICATIONS MODAL ====================*/
const modalViews = document.querySelectorAll('.publications__modal');
const modalBtns = document.querySelectorAll('.publications__content .publications__button');
const modalCloses = document.querySelectorAll('.publications__modal-close');

let openModal = function(modalClick) {
    modalViews.forEach(mv => mv.classList.remove('active-modal')); // close others
    modalViews[modalClick].classList.add('active-modal');
    history.pushState({ modalOpen: true, modalIndex: modalClick }, '', `#publication-modal-${modalClick}`);
};

let closeAllModals = function() {
    modalViews.forEach(mv => mv.classList.remove('active-modal'));
};

modalBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => openModal(i));
});

modalCloses.forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        if (history.state && history.state.modalOpen) {
            history.back();
        } else {
            closeAllModals();
        }
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.keyCode === 27) {
        if (history.state && history.state.modalOpen) {
            history.back();
        } else {
            closeAllModals();
        }
    }
});

window.addEventListener('popstate', () => {
    closeAllModals();
});


/*==================== HIGHLIGHTS SWIPER  ====================*/

let swiper = new Swiper('.highlight__container', {
  cssMode: true,
  loop: true,

  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
});

/*==================== SCROLL SECTIONS ACTIVE LINK ====================*/
const sections = document.querySelectorAll('section[id]')

function scrollActive(){
    const scrollY = window.pageYOffset

    sections.forEach(current =>{
        const sectionHeight = current.offsetHeight
        const sectionTop = current.offsetTop - 50;
        sectionId = current.getAttribute('id')

        if(scrollY > sectionTop && scrollY <= sectionTop + sectionHeight){
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.add('active-link')
        }else{
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.remove('active-link')
        }
    })
}
window.addEventListener('scroll', scrollActive)

/*==================== CHANGE BACKGROUND HEADER ====================*/ 
function scrollHeader(){
    const nav = document.getElementById('header')
    // When the scroll is greater than 200 viewport height, add the scroll-header class to the header tag
    if(this.scrollY >= 80) nav.classList.add('scroll-header'); else nav.classList.remove('scroll-header')
}
window.addEventListener('scroll', scrollHeader)

/*==================== SHOW SCROLL UP ====================*/ 
function scrollUp(){
    const scrollUp = document.getElementById('scroll-up');
    // When the scroll is higher than 560 viewport height, add the show-scroll class to the a tag with the scroll-top class
    if(this.scrollY >= 560) scrollUp.classList.add('show-scroll'); else scrollUp.classList.remove('show-scroll')
}
window.addEventListener('scroll', scrollUp)


/*==================== DARK LIGHT THEME ====================*/ 

const themeButton = document.getElementById('theme-button');
const themeImage = document.getElementById('theme-image');
const researchInterestImage = document.querySelector('.about__researchinterestimg');
const darkTheme = 'dark-theme';
const iconTheme = 'uil-sun';

// SVG image files for light and dark themes
const darkThemeImageSrc = 'assets/img/dt_ld.svg';
const lightThemeImageSrc = 'assets/img/dt_ld.svg';
const darkResearchInterestImageSrc = 'assets/img/researchinterestdark.svg';
const lightResearchInterestImageSrc = 'assets/img/researchinterest.svg';

// Check previously selected theme (if any)
const selectedTheme = localStorage.getItem('selected-theme');
const selectedIcon = localStorage.getItem('selected-icon');

// Get current theme and icon
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light';
const getCurrentIcon = () => themeButton.classList.contains(iconTheme) ? 'uil-moon' : 'uil-sun';

// Apply the previously selected theme
if (selectedTheme) {
  document.body.classList[selectedTheme === 'dark' ? 'add' : 'remove'](darkTheme);
  themeButton.classList[selectedIcon === 'uil-moon' ? 'add' : 'remove'](iconTheme);
  themeImage.src = selectedTheme === 'dark' ? darkThemeImageSrc : lightThemeImageSrc;
  researchInterestImage.src = selectedTheme === 'dark' ? darkResearchInterestImageSrc : lightResearchInterestImageSrc;
}

// Toggle theme manually with the button
themeButton.addEventListener('click', () => {
    // Toggle theme classes
    document.body.classList.toggle(darkTheme);
    themeButton.classList.toggle(iconTheme);
    
    // Update the SVG image sources based on the new theme
    themeImage.src = getCurrentTheme() === 'dark' ? darkThemeImageSrc : lightThemeImageSrc;
    researchInterestImage.src = getCurrentTheme() === 'dark' ? darkResearchInterestImageSrc : lightResearchInterestImageSrc;
    
    // Save the user's theme and icon choice
    localStorage.setItem('selected-theme', getCurrentTheme());
    localStorage.setItem('selected-icon', getCurrentIcon());
});

