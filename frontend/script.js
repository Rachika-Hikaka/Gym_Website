// PAGE CONTROL SYSTEM
const currentPage = window.location.pathname;

// Only protect dashboard
if 
(currentPage.includes("dashboard.html")) 
{
    const isLoggedIn = localStorage.getItem("user");

    if (!isLoggedIn) {
        window.location.href = "login.html";
    }
}

// LOAD MEMBERS
function loadMembers() {
    fetch("http://localhost:5000/api/members")
        .then(res => res.json())
        .then(data => {

            const list = document.getElementById("memberList");
            const count = document.getElementById("count");

            list.innerHTML = "";

            if (data.length === 0) {
                list.innerHTML = "<tr><td colspan='3'>No members yet</td></tr>";
                count.textContent = 0;
                return;
            }

            count.textContent = data.length;

            data.forEach(member => {
                const row = document.createElement("tr");
                
                row.innerHTML = `
                <td>${member.name}</td>
                <td>${member.plan}</td>
                <td>
                <button onclick='editMember(${member.id}, "${member.name}", "${member.email}", "${member.phone}", "${member.plan}")'>Edit</button>
                <button onclick="deleteMember(${member.id})">Delete</button>
                </td>
                `;

                list.appendChild(row);
            });
        })
        .catch(err => console.log(err));
}


// ADD + UPDATE MEMBER
const form = document.getElementById("contactForm");

if (form) {
    form.addEventListener("submit", function(e) {
        e.preventDefault();

        const id = this.getAttribute("data-id");

        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const plan = document.getElementById("plan").value;

        if (id) {
            fetch(`http://localhost:5000/api/members/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, phone, course, plan })
            })
            .then(res => res.json())
            .then(() => {
                alert("Member Updated");
                form.reset();
                form.removeAttribute("data-id");
                loadMembers();
            });

        } else {
            fetch("http://localhost:5000/api/members", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, phone, plan })
            })
            .then(res => res.json())
            .then(() => {
                alert("Member Added");
                form.reset();
                loadMembers();
            });
        }
    });
}


// DELETE MEMBER
function deleteMember(id) {
    fetch(`http://localhost:5000/api/members/${id}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(() => {
        alert("Deleted");
        loadMembers();
    })
    .catch(err => console.log(err));
}


// EDIT MEMBER (fill form)
function editMember(id, name, email, phone, plan) 
{
    document.getElementById("name").value = name;
    document.getElementById("email").value = email;
    document.getElementById("phone").value = phone;
    document.getElementById("plan").value = plan;

    document.getElementById("contactForm").setAttribute("data-id", id);
}


// LOGOUT
function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}


// RAZORPAY PAYMENT
function payNow() {
    const amount = document.getElementById("plan").value;
    alert("Test Payment: ₹" + amount);
}


// AUTO LOAD
if
(!list || !count) return;
{
window.addEventListener("load",loadMembers);
}