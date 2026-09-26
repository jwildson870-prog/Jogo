from flask import Flask, render_template, jsonify

app = Flask(__name__)

player = {
    "nome": "Jogador",
    "vida": 100,
    "dinheiro": 500,
    "nivel": 1
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/player")
def api_player():
    return jsonify(player)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
