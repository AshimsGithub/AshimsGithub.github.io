// Typing Effect
const typing = document.getElementById('typing');
const text = "Hello, I'm Ashim Thapa";
let index = 0;

function type() {
    typing.textContent = text.slice(0, index++);
    if (index <= text.length) {
        setTimeout(type, 100);
    }
}
type();

// Toggle Resume Content
function toggleResume() {
    document.getElementById('resume-content').classList.toggle('hidden');
}

// Theme Toggle with visual feedback
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        themeToggle.textContent = "Light Mode";
    } else {
        themeToggle.textContent = "Dark Mode";
    }
});
