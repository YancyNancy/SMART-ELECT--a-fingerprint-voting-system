
import sqlite3
import time
from flask import Flask, jsonify, request, render_template 
from flask_cors import CORS
import os
import serial
import adafruit_fingerprint
import subprocess

app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)
uart = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
finger = adafruit_fingerprint.Adafruit_Fingerprint(uart)

CURRENT_MACHINE = {
    "constituency": "Ghaziabad",
    "ward": 1
}

DB_NAME = "/home/fingerprint/voting_project/fingerprint_voting.db"
import os
print("DB PATH:", DB_NAME)
print("Exists:", os.path.exists(DB_NAME))


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def get_voter_by_fingerprint(fid):
    conn = get_db_connection()

    voter = conn.execute(
        "SELECT * FROM Voter WHERE FingerprintID = ?",
        (fid,)
    ).fetchone()

    conn.close()
    return voter



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
        conn = get_db_connection()

        conn.execute(
            "INSERT INTO admin_logs (username, login_time, logout_time) VALUES (?, datetime('now', '+5 hours', '+30 minutes'), NULL)",
            (data.get('username'),)
        )
        conn.commit()
        conn.close()

        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "message": "Invalid Credentials"})



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

    
    if voter["Constituency"].strip() != CURRENT_MACHINE["constituency"]:
        return jsonify({"success": False, "message": "Wrong Constituency"}), 400

    
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



@app.route('/cast-vote', methods=['POST'])
def cast_vote():
    data = request.json
    voter_id = data.get("voter_id")
    candidate_id = data.get("candidate_id")

    if not voter_id or not candidate_id:
        return jsonify({"success": False, "message": "Invalid vote data"}), 400

    conn = get_db_connection()

    
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
    GROUP BY c.CandidateID
""", (CURRENT_MACHINE["constituency"],)).fetchall()

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

@app.route('/')
def home():
    return render_template('index.html')

@app.route("/get-election-status", methods=["GET"])
def get_election_status():
    conn = get_db_connection()
    election = conn.execute(
        "SELECT Status FROM ElectionControl WHERE ElectionID = 1"
    ).fetchone()
    conn.close()

    if election is None:
        return jsonify({"status": "INACTIVE"})

    return jsonify({"status": election["Status"]})

@app.route('/scan-fingerprint', methods=['GET'])
def scan_fingerprint():
    try:
        print("Waiting for finger...")
        time.sleep(3)
        # Step 1
        if finger.get_image() != adafruit_fingerprint.OK:
            return jsonify({"success": False, "message": "No finger detected"})

        # Step 2
        if finger.image_2_tz(1) != adafruit_fingerprint.OK:
            return jsonify({"success": False, "message": "Failed to process fingerprint"})

        # Step 3
        if finger.finger_search() != adafruit_fingerprint.OK:
            return jsonify({"success": False, "message": "Fingerprint not registered"})

        fid = finger.finger_id

        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM Voter WHERE FingerprintID=?", (fid,))
        voter = cursor.fetchone()

        if not voter:
            return jsonify({"success": False, "message": "Voter not found"})

        if int(voter["Ward"]) != int(CURRENT_MACHINE["ward"]):
            return jsonify({
                "success": False,
                "message": "This booth is not for your ward"
            })
        cursor.execute("SELECT * FROM Vote WHERE VoterID=?", (voter[0],))
        has_voted = cursor.fetchone() is not None

        return jsonify({
            "success": True,
            "voter": {
                "VoterID": voter[0],
                "Name": voter[1],
                "Address": voter[2]
            },
            "has_voted": has_voted
        })

    except Exception as e:
        print("Fingerprint error:", e)
        return jsonify({"success": False, "message": "Fingerprint scanner error"})

@app.route('/admin-logout', methods=['POST'])
def admin_logout():
    data = request.json
    username = data.get("username")

    conn = get_db_connection()

    conn.execute("""
        UPDATE admin_logs
        SET logout_time = datetime('now')
        WHERE username = ?
        AND logout_time IS NULL
    """, (username,))

    conn.commit()
    conn.close()

    return jsonify({"success": True})
       

@app.route('/get-admin-logs', methods=['GET'])
def get_admin_logs():
    conn = get_db_connection()

    logs = conn.execute("""
        SELECT username, login_time, logout_time
        FROM admin_logs
        ORDER BY id DESC
    """).fetchall()

    conn.close()

    return jsonify([dict(row) for row in logs])


if __name__ == '__main__':
    print("Server running on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
    
