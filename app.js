const API_BASE_URL = "http://10.212.189.24:5000";


let currentVoterId = null;
let currentVoterName = "";
let currentAdminUser = "";


const roleScreen = document.getElementById("role-screen");
const voterLayout = document.getElementById("voter-layout");
const adminLayout = document.getElementById("admin-layout");
const adminLoginScreen = document.getElementById("admin-login-screen");


document.getElementById("role-voter-btn").addEventListener("click", () => {
    roleScreen.classList.add("hidden");
    voterLayout.classList.remove("hidden");
});

document.getElementById("role-admin-btn").addEventListener("click", () => {
    roleScreen.classList.add("hidden");
    adminLoginScreen.classList.remove("hidden");
});


    document.getElementById("v-manual-login-btn").addEventListener("click", async () => {
       // alert("Please use fingerprint authentication");
       // return;

    
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

        if (data.success){
   
            currentVoterId = data.voter.VoterID;
            currentVoterName = data.voter.Name;
            document.getElementById("voter-name").innerText = data.voter.Name;
            document.getElementById("voter-id").innerText = "ID: " + data.voter.VoterID;
            document.getElementById("voter-const").innerText = data.voter.Address || "Ward 1";

            if (data.has_voted) {
               
                statusMsg.innerText = "Error: Already Voted!";
                statusMsg.style.color = "red";
                document.getElementById("voter-status").innerText = "Already Voted";
                document.getElementById("voter-status").style.color = "red";
            } else {
                
                statusMsg.innerText = "Verified!";
                statusMsg.style.color = "#00e676"; // green
                document.getElementById("voter-status").innerText = "Authenticated";
                document.getElementById("voter-status").style.color = "#00e676";

                goToVotingScreen(); // Move to voting screen
            }
        } else {
            
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


document.getElementById("v-cast-vote-btn").addEventListener("click", async () => {
       console.log("CAST VOTE BUTTON CLICKED");
    const selected = document.querySelector('input[name="candidate"]:checked');
    if (!selected) {
        alert("Please select a candidate first.");
        return;
    }

    
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
    return;   
}

console.log("Vote result:", result);

        if (result.success) {

           

            document.getElementById("v-voting-screen").classList.add("hidden");

           
            document.getElementById("v-confirmation-screen").classList.remove("hidden");

            
            document.getElementById("v-step-vote").classList.remove("active");
            document.getElementById("v-step-confirm").classList.add("active");

            
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


document.getElementById("v-finish-btn").addEventListener("click", () => location.reload());
document.getElementById("v-back-to-auth").addEventListener("click", () => location.reload());
document.getElementById("reset-demo-btn").addEventListener("click", async () => {

    await fetch(`${API_BASE_URL}/admin-logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentAdminUser })
    });

    location.reload();
});
document.getElementById("admin-login-back-btn").addEventListener("click", () => location.reload());


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

            currentAdminUser = u;
            loadAdminLogs();
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


let chartInstance = null;

async function loadResults() {
    const res = await fetch(`${API_BASE_URL}/get-results`);
    const data = await res.json();

    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";

    let labels = [];
    let votes = []; 
    

    let winner = "";
    let max = -1;

    data.forEach(r => {
        if (labels.includes(r.Party)) {
    let index = labels.indexOf(r.Party);
    votes[index] += r.vote_count;
} else {
    labels.push(r.Party);
    votes.push(r.vote_count);
}

      let index = labels.indexOf(r.Party);
if (votes[index] > max) {
    max = votes[index];
    winner = r.Party;
}

        tbody.innerHTML += `
            <tr>
                <td>${r.Name}</td>
                <td>${r.Party}</td>
                <td>${r.vote_count}</td>
            </tr>
        `;
    });

    document.getElementById("winner-text").innerText =
        `Leading Party: ${winner} (${max} votes)`;

    // ===== GRAPH =====
    if (chartInstance) chartInstance.destroy();

    const ctx = document.getElementById("voteChart").getContext("2d");

    chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
        labels: labels,
        datasets: [{
            label: "Votes",
            data: votes
        }]
    },
    options: {
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1
                }
            }
        }
    }
});
    // ===== ANALYSIS =====
    let total = votes.reduce((a, b) => a + b, 0);

    let analysisText = "<strong>Vote Share:</strong><br><br>";

    labels.forEach((party, i) => {
        let percent = ((votes[i] / total) * 100).toFixed(1);
        analysisText += `${party}: ${percent}%<br>`;
    });

    let sorted = [...votes].sort((a, b) => b - a);
    let margin = sorted.length > 1 ? sorted[0] - sorted[1] : 0;

    analysisText += `<br><strong>Winning Margin:</strong> ${margin} votes`;

    document.getElementById("analysis-box").innerHTML = analysisText;
}


let demoCandidates = [];


const adminActionButtons = document.querySelectorAll(".admin-action-btn");


const manageCandidatesBtn = adminActionButtons[0];

const manageCandidatesPanel = document.getElementById("manage-candidates-panel");
const demoBody = document.getElementById("demo-candidate-body");


manageCandidatesBtn.addEventListener("click", () => {
    manageCandidatesPanel.classList.toggle("hidden");
});


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






const manageElectionBtn = document.querySelectorAll(".admin-action-btn")[1];

const manageElectionPanel = document.getElementById("manage-election-panel");
const electionStatusText = document.getElementById("demo-election-status");


manageElectionBtn.addEventListener("click", () => {
    manageElectionPanel.classList.toggle("hidden");
});

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

   
    const partyImages = {
        "Party D": "/static/assets/party-icons/party-d.png",
        "Party E": "/static/assets/party-icons/party-e.png",
        "Party F": "/static/assets/party-icons/party-f.png",
        "None": "/static/assets/party-icons/nota.png"
    };

    
    const defaultImage = "/static/assets/party-icons/party-d.png";

    try {
        const res = await fetch(`${API_BASE_URL}/get-candidates`);
        const candidates = await res.json();

        list.innerHTML = "";
        candidates.forEach(c => {
            
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

            const statusRes = await fetch(`${API_BASE_URL}/get-election-status`);
            const statusData = await statusRes.json();

            if (statusData.status !== "ACTIVE") {
                alert("Voting is closed!");
                return;
            }

            currentVoterId = data.voter.VoterID;
            currentVoterName = data.voter.Name;

            document.getElementById("voter-name").innerText = data.voter.Name;
            document.getElementById("voter-id").innerText = "ID: " + data.voter.VoterID;
            document.getElementById("voter-const").innerText = data.voter.Address;
            document.getElementById("voter-status").innerText = "Authenticated";
            document.getElementById("voter-status").style.color = "#00e676";

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
async function loadAdminLogs() {
    try {
        const res = await fetch(`${API_BASE_URL}/get-admin-logs`);
        const logs = await res.json();

        const tbody = document.getElementById("admin-logs-body");
        tbody.innerHTML = "";

        logs.forEach(log => {
            tbody.innerHTML += `
                <tr>
                    <td>${log.username}</td>
                    <td>${log.login_time}</td>
                    <td>${log.logout_time || "Active"}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Admin logs error:", err);
    }
}

async function downloadReport() {

    const res = await fetch(`${API_BASE_URL}/get-results`);
    const data = await res.json();

    let csv = "Election Report\n\n";
    csv += "Candidate,Party,Votes\n";

    let totalVotes = 0;

    data.forEach(r => {
        totalVotes += r.vote_count;
        csv += `${r.Name},${r.Party},${r.vote_count}\n`;
    });

    csv += `\nTotal Votes, ,${totalVotes}\n`;

    // file banana
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "election_report.csv";
    a.click();

    window.URL.revokeObjectURL(url);
}