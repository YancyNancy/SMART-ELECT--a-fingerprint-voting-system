const API_BASE_URL = "http://10.27.250.24:5000";

// STATE
let currentVoterId = null;
let currentVoterName = "";

// SCREENS & BUTTONS
const roleScreen = document.getElementById("role-screen");
const voterLayout = document.getElementById("voter-layout");
const adminLayout = document.getElementById("admin-layout");
const adminLoginScreen = document.getElementById("admin-login-screen");

// --- NAVIGATION ---
document.getElementById("role-voter-btn").addEventListener("click", () => {
    roleScreen.classList.add("hidden");
    voterLayout.classList.remove("hidden");
});

document.getElementById("role-admin-btn").addEventListener("click", () => {
    roleScreen.classList.add("hidden");
    adminLoginScreen.classList.remove("hidden");
});

// --- VOTER LOGIN (MANUAL ID) ---
    document.getElementById("v-manual-login-btn").addEventListener("click", async () => {
       // alert("Please use fingerprint authentication");
       // return;

    // ===== CHECK ELECTION STATUS BEFORE LOGIN =====
    const statusRes = await fetch(`${API_BASE_URL}/get-election-status`);

const statusText = await statusRes.text();
console.log("STATUS RAW:", statusText);

let statusData;
try {
    statusData = JSON.parse(statusText);
} catch (e) {
    console.error("STATUS JSON ERROR:", e);
    alert("Server not returning proper data for election status");
    return;
}

    if (statusData.status !== "ACTIVE") {
        alert("Election has not started or has already ended.");
        return;
    }
    const inputField = document.getElementById("manual-voter-id");
    const statusMsg = document.getElementById("v-auth-status");
    const enteredId = inputField.value.trim();

    if (!enteredId) {
        statusMsg.innerText = "Please enter your Voter ID";
        statusMsg.style.color = "red";
        return;
    }

    statusMsg.innerText = "Checking Database...";
    statusMsg.style.color = "black";

    try {
        const response = await fetch(`${API_BASE_URL}/auth-voter`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voter_id: enteredId })
        });

        const text = await response.text();
        console.log("RAW RESPONSE:", text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("JSON ERROR:", e);
            return;
        }

        if (data.success) {
            // Fill sidebar with voter info
            currentVoterId = data.voter.VoterID;
            currentVoterName = data.voter.Name;
            document.getElementById("voter-name").innerText = data.voter.Name;
            document.getElementById("voter-id").innerText = "ID: " + data.voter.VoterID;
            document.getElementById("voter-const").innerText = data.voter.Address || "Ward 1";

            if (data.has_voted) {
                // Already voted
                statusMsg.innerText = "Error: Already Voted!";
                statusMsg.style.color = "red";
                document.getElementById("voter-status").innerText = "Already Voted";
                document.getElementById("voter-status").style.color = "red";
            } else {
                // Login Success
                statusMsg.innerText = "Verified!";
                statusMsg.style.color = "#00e676"; // green
                document.getElementById("voter-status").innerText = "Authenticated";
                document.getElementById("voter-status").style.color = "#00e676";

                goToVotingScreen(); // Move to voting screen
            }
        } else {
            // Invalid ID
            statusMsg.innerText = data.message;
            statusMsg.style.color = "red";
        }
    } catch (err) {
        statusMsg.innerText = "Server Error. Is Python running?";
        statusMsg.style.color = "red";
        console.error(err);
    }
});

// --- NAVIGATION FUNCTIONS ---
async function goToVotingScreen() {
    document.getElementById("v-auth-screen").classList.add("hidden");
    document.getElementById("v-voting-screen").classList.remove("hidden");
    document.getElementById("v-step-auth").classList.remove("active");
    document.getElementById("v-step-vote").classList.add("active");
    await loadCandidatesWithImages();
    await loadElectionStatus();
}

async function loadCandidates() {
    const list = document.getElementById("candidate-list");
    list.innerHTML = "Loading...";
    try {
        const res = await fetch(`${API_BASE_URL}/get-candidates`);
        const candidates = await res.json();

        list.innerHTML = "";
        candidates.forEach(c => {
            list.innerHTML += `
                <label class="candidate-card">
                    <input type="radio" name="candidate" value="${c.CandidateID}" data-name="${c.Name}">
                    <div class="candidate-content">
                        <h3>${c.Name}</h3>
                        <p>${c.Party}</p>
                    </div>
                </label>
            `;
        });
    } catch (err) {
        list.innerHTML = "Error fetching candidates.";
        console.error(err);
    }
}

// --- CAST VOTE ---
document.getElementById("v-cast-vote-btn").addEventListener("click", async () => {
       console.log("CAST VOTE BUTTON CLICKED");
    const selected = document.querySelector('input[name="candidate"]:checked');
    if (!selected) {
        alert("Please select a candidate first.");
        return;
    }

    // Candidate ka naam nikala taaki Confirmation page pe dikha sakein
    const candidateName = selected.getAttribute("data-name");

    try {
        const res = await fetch(`${API_BASE_URL}/cast-vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                voter_id: currentVoterId,
                candidate_id: selected.value
            })
        });

        const result = await res.json();

if (!res.ok) {
    alert(result.message);
    return;   // VERY IMPORTANT
}

console.log("Vote result:", result);

        if (result.success) {

            // === YAHAN SCREEN CHANGE HOGI ===

            // 1. Voting Screen ko chupao
            document.getElementById("v-voting-screen").classList.add("hidden");

            // 2. Confirmation Screen (Done Page) ko dikhao
            document.getElementById("v-confirmation-screen").classList.remove("hidden");

            // 3. Upar Steps mein "3. Done" ko green karo
            document.getElementById("v-step-vote").classList.remove("active");
            document.getElementById("v-step-confirm").classList.add("active");

            // 4. Details show karo (Voter Name, Candidate Name, Transaction ID)
            document.getElementById("c-voter-name").innerText = currentVoterName;
            document.getElementById("c-candidate-name").innerText = candidateName;
            document.getElementById("c-txn-id").innerText = result.transaction_id;

        } else {
            alert(result.message);
        }
    } catch (err) {
        alert("Server Error. Try again.");
        console.error(err);
    }
});

// --- LOGOUT / RESET ---
document.getElementById("v-finish-btn").addEventListener("click", () => location.reload());
document.getElementById("v-back-to-auth").addEventListener("click", () => location.reload());
document.getElementById("reset-demo-btn").addEventListener("click", () => location.reload());
document.getElementById("admin-login-back-btn").addEventListener("click", () => location.reload());

// --- ADMIN LOGIN ---
document.getElementById("admin-login-btn").addEventListener("click", async () => {
    const u = document.getElementById("admin-id-input").value;
    const p = document.getElementById("admin-password-input").value;

    try {
        const res = await fetch(`${API_BASE_URL}/admin-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById("admin-login-screen").classList.add("hidden");
            adminLayout.classList.remove("hidden");
            loadResults();
            loadElectionStatus(); 
        } else {
            alert("Wrong credentials");
        }
    } catch (err) {
        alert("Server error");
    }
});

["v-finish-btn", "v-back-to-auth", "reset-demo-btn", "admin-login-back-btn"]
.forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => location.reload());
});

/* ================= FORGOT PASSWORD (UI ONLY) ================= */
document.querySelector("a[href='#']")?.addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("forgot-password-modal").classList.remove("hidden");
});

document.getElementById("close-forgot-modal")?.addEventListener("click", () => {
    document.getElementById("forgot-password-modal").classList.add("hidden");
});


async function loadResults() {
    const res = await fetch(`${API_BASE_URL}/get-results`);
    const data = await res.json();
    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";
    let winner = "";
    let max = -1;

    data.forEach(r => {
        if (r.vote_count > max) {
            max = r.vote_count;
            winner = r.Name;
        }
        tbody.innerHTML += `<tr><td>${r.Name}</td><td>${r.Party}</td><td>${r.vote_count}</td></tr>`;
    });

    document.getElementById("winner-text").innerText = `Leading: ${winner} (${max} votes)`;
}


/* =====================================================
   ADMIN → MANAGE CANDIDATES (DEMO ONLY - UI LEVEL)
   ===================================================== */

// DEMO candidate list (ADMIN ONLY)
let demoCandidates = [];

// BUTTON REFERENCES (Admin dashboard buttons)
const adminActionButtons = document.querySelectorAll(".admin-action-btn");

// 2nd button = Manage Candidates
const manageCandidatesBtn = adminActionButtons[1];

// PANEL (HTML jo maine pehle diya tha)
const manageCandidatesPanel = document.getElementById("manage-candidates-panel");
const demoBody = document.getElementById("demo-candidate-body");

// TOGGLE PANEL
manageCandidatesBtn.addEventListener("click", () => {
    manageCandidatesPanel.classList.toggle("hidden");
});

// ADD DEMO CANDIDATE
document.getElementById("add-demo-candidate").addEventListener("click", () => {
    const name = document.getElementById("demo-cand-name").value.trim();
    const party = document.getElementById("demo-cand-party").value.trim();

    if (!name || !party) {
        alert("Please enter candidate name and party");
        return;
    }

    demoCandidates.push({ name, party });
    renderDemoCandidates();

    document.getElementById("demo-cand-name").value = "";
    document.getElementById("demo-cand-party").value = "";
});

// RENDER DEMO CANDIDATES
function renderDemoCandidates() {
    demoBody.innerHTML = "";

    demoCandidates.forEach((c, index) => {
        demoBody.innerHTML += `
            <tr>
                <td>${c.name}</td>
                <td>${c.party}</td>
                <td>
                    <button class="secondary-btn"
                            onclick="deleteDemoCandidate(${index})">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

// DELETE DEMO CANDIDATE
function deleteDemoCandidate(index) {
    demoCandidates.splice(index, 1);
    renderDemoCandidates();
}

/* =====================================================
   ADMIN → MANAGE VOTERS (DEMO ONLY - UI LEVEL)
   ===================================================== */

let demoVoters = [];

// Admin buttons (already selected earlier)
const manageVotersBtn = document.querySelectorAll(".admin-action-btn")[0]; // 1st button

const manageVotersPanel = document.getElementById("manage-voters-panel");
const demoVoterBody = document.getElementById("demo-voter-body");

// TOGGLE PANEL
manageVotersBtn.addEventListener("click", () => {
    manageVotersPanel.classList.toggle("hidden");
});

// ADD DEMO VOTER
document.getElementById("add-demo-voter").addEventListener("click", () => {
    const name = document.getElementById("demo-voter-name").value.trim();
    const id = document.getElementById("demo-voter-id").value.trim();

    if (!name || !id) {
        alert("Please enter voter name and voter ID");
        return;
    }

    demoVoters.push({ name, id });
    renderDemoVoters();

    document.getElementById("demo-voter-name").value = "";
    document.getElementById("demo-voter-id").value = "";
});

// RENDER DEMO VOTERS
function renderDemoVoters() {
    demoVoterBody.innerHTML = "";

    demoVoters.forEach((v, index) => {
        demoVoterBody.innerHTML += `
            <tr>
                <td>${v.name}</td>
                <td>${v.id}</td>
                <td>
                    <button class="secondary-btn"
                            onclick="deleteDemoVoter(${index})">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

// DELETE DEMO VOTER
function deleteDemoVoter(index) {
    demoVoters.splice(index, 1);
    renderDemoVoters();
}


/* =====================================================
   ADMIN → MANAGE ELECTION (DEMO ONLY - UI LEVEL)
   ===================================================== */

// 3rd admin button = Manage Election
const manageElectionBtn = document.querySelectorAll(".admin-action-btn")[2];

const manageElectionPanel = document.getElementById("manage-election-panel");
const electionStatusText = document.getElementById("demo-election-status");

// TOGGLE PANEL
manageElectionBtn.addEventListener("click", () => {
    manageElectionPanel.classList.toggle("hidden");
});

// START ELECTION
document.getElementById("demo-start-election").addEventListener("click", async () => {
    const res = await fetch(`${API_BASE_URL}/set-election-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" })
    });

    const data = await res.json();
    alert(data.message);
    loadElectionStatus();
});

// END ELECTION
document.getElementById("demo-end-election").addEventListener("click", async () => {
    const res = await fetch(`${API_BASE_URL}/set-election-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENDED" })
    });

    const data = await res.json();
    alert(data.message);
    loadElectionStatus();
});

// ================= FORGOT PASSWORD (UI ONLY) =================
document.getElementById("forgot-password-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("forgot-password-modal").classList.remove("hidden");
});

document.getElementById("close-forgot-modal")?.addEventListener("click", () => {
    document.getElementById("forgot-password-modal").classList.add("hidden");
});
async function loadCandidatesWithImages() {
    const list = document.getElementById("candidate-list");
    list.innerHTML = "Loading...";

    // === YAHAN APNI PHOTOS KA NAAM LIKHEIN ===
    // "Party Ka Naam": "Photo Ka Path"
   // === YAHAN PATH FIX KIYA HAI ===
    const partyImages = {
        "Party D": "/static/assets/party-icons/party-d.png",
        "Party E": "/static/assets/party-icons/party-e.png",
        "Party F": "/static/assets/party-icons/party-f.png",
        "None": "/static/assets/party-icons/nota.png"
    };

    // Default image ka path bhi sahi folder se dein (agar koi image missing ho)
    const defaultImage = "/static/assets/party-icons/party-d.png";

    try {
        const res = await fetch(`${API_BASE_URL}/get-candidates`);
        const candidates = await res.json();

        list.innerHTML = "";
        candidates.forEach(c => {
            // Yahan check kar rahe hain ki is party ki photo list mein hai ya nahi
            // Agar nahi hai, to default photo use hogi

            let imagePath;

            if (c.Name === "NOTA") {
                imagePath = "/static/assets/party-icons/nota.png";
} else {
    imagePath = partyImages[c.Party] || defaultImage;
}
            list.innerHTML += `
                <label class="candidate-card">
                    <input type="radio" name="candidate" value="${c.CandidateID}" data-name="${c.Name}">
                    
                    <img src="${imagePath}" 
                         alt="${c.Party}" 
                         class="party-symbol-img"
                         onerror="this.src='${defaultImage}'"> 

                    <div class="candidate-content">
                        <h3>${c.Name}</h3>
                        <p>${c.Party}</p>
                    </div>
                </label>
            `;
        });

  
    } catch (err) {
        list.innerHTML = "Error fetching candidates.";
        console.error(err);
    }
}

// ================= SET BOOTH =================
function setBooth() {
  const ward = document.getElementById("boothWardSelect").value;

  fetch(`${API_BASE_URL}/set-booth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ward: parseInt(ward),
      constituency: "Ghaziabad"
    })
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message);
    loadResults(); // auto refresh
  })
  .catch(err => {
    console.error("Set booth error:", err);
  });
}

async function loadElectionStatus() {
    try {

        const res = await fetch(`${API_BASE_URL}/get-election-status`);
        const data = await res.json();

        const statusElement = document.getElementById("demo-election-status");
        const voteBtn = document.getElementById("v-cast-vote-btn");

        statusElement.innerText = "Status: " + data.status;

        if (data.status === "ACTIVE") {

            statusElement.style.color = "#00e676";

            if (voteBtn) {
                voteBtn.disabled = false;
                voteBtn.innerText = "Cast Vote";
            }

        } else {

            statusElement.style.color = "orange";

            if (voteBtn) {
                voteBtn.disabled = true;
                voteBtn.innerText = "Voting Closed";
            }

        }

    } catch (err) {
        console.error("Status fetch error:", err);
    }
}

document.getElementById("fingerprint-login-btn")?.addEventListener("click", async () => {

    alert("Place your finger on the scanner");

    try {

        const response = await fetch(`${API_BASE_URL}/scan-fingerprint`);
        const data = await response.json();

        if (data.success) {

            currentVoterId = data.voter.VoterID;
            currentVoterName = data.voter.Name;

            document.getElementById("voter-name").innerText = data.voter.Name;
            document.getElementById("voter-id").innerText = "ID: " + data.voter.VoterID;
            document.getElementById("voter-const").innerText = data.voter.Address;

            if (data.has_voted) {
                alert("Already voted!");
            } else {
                goToVotingScreen();
            }

        } else {
            alert(data.message);
        }

    } catch (err) {
        alert("Fingerprint scanner error");
        console.error(err);
    }

});
