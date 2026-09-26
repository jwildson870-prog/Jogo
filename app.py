from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

player = {
    "nome": "Jogador",
    "vida": 100,
    "dinheiro": 500,
    "nivel": 1,
    "xp": 0,
    "xp_proximo": 100,
    "energia": 100,
    "inventario": []
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/player")
def api_player():
    return jsonify(player)

@app.post("/api/player")
def update_player():
    data = request.get_json(silent=True) or {}
    for key in ("nome", "vida", "dinheiro", "nivel", "xp", "xp_proximo", "energia", "inventario"):
        if key in data:
            player[key] = data[key]
    return jsonify({"ok": True, "player": player})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
