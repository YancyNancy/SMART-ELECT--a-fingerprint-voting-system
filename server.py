import sqlite3
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

CURRENT_MACHINE = {
    "constituency": "Ghaziabad",
    "ward": 1
}

DB_NAME = r"C:\Users\hp\OneDrive\Desktop\fingerprint new\fingerprint_voting.db"
print("DB file exists:", os.path.exists(DB_NAME))


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn
# ---------- FINGERPRINT HELPER ----------
def get_voter_by_fingerprint(fid):
    conn = get_db_connection()

    voter = conn.execute(
        "SELECT * FROM Voter WHERE FingerprintID = ?",
        (fid,)
    ).fetchone()

    conn.close()
    return voter


# ================= ADMIN LOGIN =================
@app.route('/admin-login', methods=['POST'])
def admin_login():
    data = request.json
    conn = get_db_connection()

    admin = conn.execute(
        'SELECT * FROM Admin WHERE Username = ? AND Password = ?',
        (data.get('username'), data.get('password'))
    ).fetchone()

    conn.close()

    if admin:
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "message": "Invalid Credentials"})


# ================= VOTER LOGIN =================
@app.route('/auth-voter', methods=['POST'])
def auth_voter():
    data = request.json
    voter_id = data.get("voter_id")

    if not voter_id:
        return jsonify({"success": False, "message": "No Voter ID entered"}), 400

    conn = get_db_connection()

    voter = conn.execute(
        'SELECT * FROM Voter WHERE VoterID = ?',
        (voter_id,)
    ).fetchone()

    conn.close()

    if not voter:
        return jsonify({"success": False, "message": "Invalid Voter ID"}), 400

    # Constituency Check
    if voter["Constituency"].strip() != CURRENT_MACHINE["constituency"]:
        return jsonify({"success": False, "message": "Wrong Constituency"}), 400

    # Ward Check
    if int(voter["Ward"]) != int(CURRENT_MACHINE["ward"]):
        return jsonify({"success": False, "message": "This booth is not for your ward"}), 400

    return jsonify({
        "success": True,
        "voter": {
            "VoterID": voter["VoterID"],
            "Name": voter["Name"],
            "Address": voter["Address"]
        },
        "has_voted": voter["HasVoted"] == 1
    })


# ================= GET CANDIDATES =================
@app.route('/get-candidates', methods=['GET'])
def get_candidates():
    conn = get_db_connection()

    candidates = conn.execute(
        '''
        SELECT CandidateID, Name, Party
        FROM Candidate
        WHERE Constituency = ?
        AND (Ward = ? OR Ward = 0)
        ''',
        (CURRENT_MACHINE["constituency"], CURRENT_MACHINE["ward"])
    ).fetchall()

    conn.close()

    return jsonify([dict(row) for row in candidates])


# ================= CAST VOTE =================
@app.route('/cast-vote', methods=['POST'])
def cast_vote():
    data = request.json
    voter_id = data.get("voter_id")
    candidate_id = data.get("candidate_id")

    if not voter_id or not candidate_id:
        return jsonify({"success": False, "message": "Invalid vote data"}), 400

    conn = get_db_connection()

    # ================= CHECK ELECTION STATUS =================
    status_row = conn.execute(
        "SELECT Status FROM ElectionControl WHERE ElectionID = 1"
    ).fetchone()

    if not status_row or status_row["Status"].upper() != "ACTIVE":
        conn.close()
        return jsonify({
            "success": False,
            "message": "Election is not active"
        }), 403

    voter = conn.execute(
        'SELECT HasVoted, Constituency, Ward FROM Voter WHERE VoterID = ?',
        (voter_id,)
    ).fetchone()

    if not voter:
        conn.close()
        return jsonify({"success": False, "message": "Voter not found"}), 400

    if voter["HasVoted"] == 1:
        conn.close()
        return jsonify({"success": False, "message": "Already Voted"}), 400

    if voter["Constituency"].strip() != CURRENT_MACHINE["constituency"]:
        conn.close()
        return jsonify({"success": False, "message": "Wrong Constituency"}), 400

    if int(voter["Ward"]) != int(CURRENT_MACHINE["ward"]):
        conn.close()
        return jsonify({"success": False, "message": "Wrong Ward"}), 400

    conn.execute(
        'INSERT INTO Vote (VoterID, CandidateID, ElectionID) VALUES (?, ?, 1)',
        (voter_id, candidate_id)
    )

    conn.execute(
        'UPDATE Voter SET HasVoted = 1 WHERE VoterID = ?',
        (voter_id,)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "transaction_id": f"TXN-{int(time.time())}"
    })

# ================= RESULTS =================
@app.route('/get-results', methods=['GET'])
def get_results():
    conn = get_db_connection()

    results = conn.execute("""
        SELECT 
            c.Name,
            c.Party,
            COUNT(v.VoteID) AS vote_count
        FROM Candidate c
        LEFT JOIN Vote v ON c.CandidateID = v.CandidateID
        WHERE c.Constituency = ?
        AND (c.Ward = ? OR c.Ward = 0)
        GROUP BY c.CandidateID
    """, (CURRENT_MACHINE["constituency"], CURRENT_MACHINE["ward"])).fetchall()

    conn.close()

    return jsonify([dict(row) for row in results])


# ================= SET BOOTH =================
@app.route('/set-booth', methods=['POST'])
def set_booth():
    data = request.json

    ward = data.get("ward")
    constituency = data.get("constituency")

    if not ward or not constituency:
        return jsonify({"success": False, "message": "Invalid data"}), 400

    CURRENT_MACHINE["ward"] = int(ward)
    CURRENT_MACHINE["constituency"] = constituency

    return jsonify({
        "success": True,
        "message": f"Booth set to {constituency} - Ward {ward}"
    })

# ================= SET ELECTION STATUS =================
@app.route('/set-election-status', methods=['POST'])
def set_election_status():
    data = request.json
    status = data.get("status")

    if status not in ["NOT_STARTED", "ACTIVE", "ENDED"]:
        return jsonify({"success": False, "message": "Invalid status"}), 400

    conn = get_db_connection()
    conn.execute(
        "UPDATE ElectionControl SET Status = ? WHERE ElectionID = 1",
        (status,)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Election status set to {status}"
    })

# ================= GET ELECTION STATUS =================
@app.route('/get-election-status', methods=['GET'])
def get_election_status():
    conn = get_db_connection()
    election = conn.execute(
        "SELECT Status FROM ElectionControl WHERE ElectionID = 1"
    ).fetchone()
    conn.close()

    return jsonify({"status": election["Status"]})


@app.route('/test-fingerprint/<int:fid>')
def test_fingerprint(fid):

    voter = get_voter_by_fingerprint(fid)

    if voter:
        return jsonify({
            "found": True,
            "name": voter["Name"],
            "voter_id": voter["VoterID"],
            "has_voted": voter["HasVoted"] == 1
        })
    else:
        return jsonify({
            "found": False
        })
        
        
        # ----------- NEW ROUTE ADD HERE -----------

@app.route('/fingerprint-login/<int:fid>')
def fingerprint_login(fid):

    voter = get_voter_by_fingerprint(fid)

    if not voter:
        return jsonify({
            "success": False,
            "message": "Fingerprint not registered"
        })

    return jsonify({
        "success": True,
        "voter": {
            "VoterID": voter["VoterID"],
            "Name": voter["Name"],
            "Address": voter["Address"]
        },
        "has_voted": voter["HasVoted"] == 1
    })


# ================= RUN =================
if __name__ == '__main__':
    print("Server running on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
    