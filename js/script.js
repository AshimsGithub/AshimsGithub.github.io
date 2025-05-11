// Typing effect
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

// Toggle resume content
function toggleResume() {
    document.getElementById('resume-content').classList.toggle('hidden');
}

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});
