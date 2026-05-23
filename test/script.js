/**
 * Modern Portfolio JavaScript
 * Handles animations, interactions, and functionality
 */

// DOM Elements
const navbar = document.querySelector('.navbar');
const mobileToggle = document.querySelector('.mobile-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const skillProgress = document.querySelectorAll('.skill-progress');
const statNumbers = document.querySelectorAll('.stat-number');
const contactForm = document.getElementById('contactForm');
const projectCards = document.querySelectorAll('.project-card');

// Navigation Scroll Effect
let lastScroll = 0;
const navbarHeight = navbar.offsetHeight;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Mobile Menu Toggle
mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    mobileToggle.classList.toggle('active');
    mobileToggle.setAttribute('aria-expanded', navMenu.classList.contains('active'));
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target) && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
    }
});

// Close mobile menu when clicking nav links
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
        }
    });
});

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Update active nav link
            navLinks.forEach(link => link.classList.remove('active'));
            this.classList.add('active');
        }
    });
});

// Active Navigation Link on Scroll
const sections = document.querySelectorAll('section[id]');
const options = { threshold: 0.5 };

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach(link => {
                if (link.getAttribute('href') === `#${id}`) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }
    });
}, options);

sections.forEach(section => {
    observer.observe(section);
});

// Skill Progress Animation
const animateSkillProgress = () => {
    skillProgress.forEach(progress => {
        const width = progress.getAttribute('data-width');
        progress.style.width = `${width}%`;
    });
};

// Stat Counter Animation
const animateStatNumbers = () => {
    statNumbers.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;
        
        const updateStat = () => {
            current += increment;
            if (current < target) {
                stat.textContent = Math.floor(current);
                requestAnimationFrame(updateStat);
            } else {
                stat.textContent = target;
            }
        };
        
        requestAnimationFrame(updateStat);
    });
};

// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = entry.target;
            
            if (target.classList.contains('skill-category')) {
                const skillsContainer = target.closest('.skills-grid');
                if (skillsContainer && !skillsContainer.dataset.animated) {
                    animateSkillProgress();
                    skillsContainer.dataset.animated = 'true';
                }
            }
            
            if (target.classList.contains('about-stats')) {
                if (!target.dataset.animated) {
                    animateStatNumbers();
                    target.dataset.animated = 'true';
                }
            }
            
            if (target.classList.contains('project-card')) {
                target.classList.add('fade-in');
            }
            
            if (target.classList.contains('contact-content')) {
                if (!target.dataset.animated) {
                    target.dataset.animated = 'true';
                }
            }
            
            animationObserver.unobserve(target);
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.skill-category').forEach(el => animationObserver.observe(el));
document.querySelectorAll('.about-stats').forEach(el => animationObserver.observe(el));
document.querySelectorAll('.project-card').forEach(el => animationObserver.observe(el));
document.querySelectorAll('.contact-content').forEach(el => animationObserver.observe(el));

// Project Card Hover Effects
projectCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
});

// Contact Form Handling
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const formDataObj = Object.fromEntries(formData.entries());
    
    // Simulate form submission
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        // Reset form
        contactForm.reset();
        
        // Show success message
        submitButton.textContent = 'Message Sent!';
        submitButton.style.background = 'var(--accent-color)';
        
        setTimeout(() => {
            submitButton.textContent = originalText;
            submitButton.style.background = '';
            submitButton.disabled = false;
        }, 3000);
    }, 1500);
});

// Typing Effect for Hero Section
const typingText = document.querySelector('.typing-text');
const phrases = ['Building Digital Experiences', 'Creating Modern Solutions', 'Developing Scalable Apps'];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 100;

const typeEffect = () => {
    const currentPhrase = phrases[phraseIndex];
    
    if (isDeleting) {
        typingText.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 50;
    } else {
        typingText.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 100;
    }
    
    if (!isDeleting && charIndex === currentPhrase.length) {
        isDeleting = true;
        typeSpeed = 2000;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 500;
    }
    
    setTimeout(typeEffect, typeSpeed);
};

// Start typing effect after initial delay
setTimeout(typeEffect, 1000);

// Parallax Effect for Hero Background
let parallaxEnabled = true;

window.addEventListener('scroll', () => {
    if (!parallaxEnabled) return;
    
    const scrolled = window.pageYOffset;
    const orbs = document.querySelectorAll('.gradient-orb');
    
    orbs.forEach((orb, index) => {
        const speed = (index + 1) * 0.05;
        const yPos = -(scrolled * speed);
        orb.style.transform = `translateY(${yPos}px)`;
    });
});

// Preload Animations
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    // Reveal elements on load
    setTimeout(() => {
        document.querySelectorAll('.hero-title, .hero-subtitle, .hero-buttons').forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('fade-in');
            }, index * 200);
        });
    }, 500);
});

// Focus Management for Accessibility
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        document.body.classList.add('using-keyboard');
    }
    
    // Close mobile menu on Escape
    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.focus();
    }
});

// Smooth Transitions for Color Scheme Changes
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.style.colorScheme = 'dark';
}

// Performance Optimization
if ('IntersectionObserver' in window) {
    // Lazy load images if added later
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
                imageObserver.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

// Error Handling
window.addEventListener('error', (e) => {
    console.error('Error occurred:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Clean up any event listeners or resources
    animationObserver.disconnect();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Portfolio loaded successfully');
    
    // Add loading class
    document.body.classList.add('loading');
    
    // Remove loading class after content is ready
    setTimeout(() => {
        document.body.classList.remove('loading');
    }, 1000);
});

// Export functions for external use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        animateSkillProgress,
        animateStatNumbers,
        typeEffect
    };
}
