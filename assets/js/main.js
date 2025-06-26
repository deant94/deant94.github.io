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

/*==================== history TABS ====================*/

const tabs = document.querySelectorAll('[data-target]'),
    tabContents = document.querySelectorAll('[data-content]')

tabs.forEach(tab =>{
    tab.addEventListener('click', () =>{
        const target = document.querySelector(tab.dataset.target)

        tabContents.forEach(tabContent =>{
            tabContent.classList.remove('history__active')
        })
        target.classList.add('history__active')

        tabs.forEach(tab =>{
            tab.classList.remove('history__active')
        })
        tab.classList.add('history__active')
    })
})
/*==================== publications MODAL ====================*/
const modalViews = document.querySelectorAll('.publications__modal'),
      modalBtns = document.querySelectorAll('.publications__button'),
      modalCloses = document.querySelectorAll('.publications__modal-close')

let modal = function(modalClick){
    modalViews[modalClick].classList.add('active-modal')
}

modalBtns.forEach((modalBtn, i) => {
    modalBtn.addEventListener('click', () =>{
        modal(i)
    })
})

modalCloses.forEach((modalClose) => {
    modalClose.addEventListener('click', () =>{
        modalViews.forEach((modalView) =>{
            modalView.classList.remove('active-modal')
        })
    })
})

//*==================== Escape KEY FUNCTIONALITY ====================*/
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 27) { // Check for 'Escape' key or keyCode 27
        modalViews.forEach((modalView) => {
            if (modalView.classList.contains('active-modal')) {
                modalView.classList.remove('active-modal');
            }
        });
    }
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

