"""
Respuestas Rápidas — local helper for canned WhatsApp replies with rotating
wording, so the same answer never goes out with exactly the same text twice
in a row (helps avoid WhatsApp's "repetitive message" spam detection).

Run with:  python app.py
Then open: http://127.0.0.1:5050
All data is stored locally in data.db (SQLite) next to this file.
"""

import sqlite3
import random
import os
from datetime import datetime
from flask import Flask, g, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data.db")

app = Flask(__name__, static_folder="static", template_folder="templates")

# A friendly, non-default palette. Categories are auto-assigned a color from
# here (cycling) unless the user picks one manually.
PALETTE = [
    "#1F6F63", "#E8875A", "#3D6EB5", "#B5563D",
    "#5C8A3A", "#8A5CB0", "#C4933A", "#3D8A8A",
]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    fresh = not os.path.exists(DB_PATH)
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#1F6F63',
            sort_order INTEGER NOT NULL DEFAULT 0,
            last_variation_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS variations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            times_used INTEGER NOT NULL DEFAULT 0,
            last_used TEXT
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            category_name TEXT NOT NULL,
            variation_id INTEGER,
            text TEXT NOT NULL,
            sent_at TEXT NOT NULL
        );
        """
    )
    db.commit()

    if fresh:
        # Seed with a couple of examples so the app isn't empty on first run.
        seed = [
            (
                "Promo Sofá",
                PALETTE[0],
                [
                    "¡Sí! Tenemos ese sofá en promoción a $X, o en 3 pagos fáciles de $Y.",
                    "¡Hola! Sí, contamos con ese sofá en oferta a $X, también podés pagarlo en 3 cuotas de $Y.",
                    "¡Buenísima elección! Ese modelo está en promo a $X, o en 3 pagos de $Y si preferís.",
                ],
            ),
            (
                "Horarios de atención",
                PALETTE[1],
                [
                    "Atendemos de lunes a viernes de 9 a 18hs, y sábados de 9 a 13hs.",
                    "¡Hola! Nuestro horario es de lunes a viernes 9 a 18hs y sábados 9 a 13hs.",
                    "Te comento nuestros horarios: Lun-Vie 9 a 18hs, Sáb 9 a 13hs.",
                ],
            ),
            (
                "Métodos de pago",
                PALETTE[2],
                [
                    "Aceptamos transferencia, tarjeta de débito/crédito y efectivo. ¡También cuotas sin interés!",
                    "¡Hola! Podés pagar por transferencia, tarjeta o efectivo, y tenemos cuotas sin interés disponibles.",
                    "Trabajamos con transferencia, débito, crédito (con cuotas sin interés) y efectivo.",
                ],
            ),
        ]
        cur = db.cursor()
        for order, (name, color, variations) in enumerate(seed):
            cur.execute(
                "INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)",
                (name, color, order),
            )
            cat_id = cur.lastrowid
            for v in variations:
                cur.execute(
                    "INSERT INTO variations (category_id, text) VALUES (?, ?)",
                    (cat_id, v),
                )
        db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(app.template_folder, "index.html")


# ---------------------------------------------------------------------------
# API: categories
# ---------------------------------------------------------------------------

@app.route("/api/categories", methods=["GET"])
def list_categories():
    db = get_db()
    cats = db.execute(
        "SELECT * FROM categories ORDER BY sort_order ASC, id ASC"
    ).fetchall()
    result = []
    for c in cats:
        variations = db.execute(
            "SELECT * FROM variations WHERE category_id = ? ORDER BY id ASC",
            (c["id"],),
        ).fetchall()
        result.append(
            {
                "id": c["id"],
                "name": c["name"],
                "color": c["color"],
                "sort_order": c["sort_order"],
                "variations": [
                    {
                        "id": v["id"],
                        "text": v["text"],
                        "times_used": v["times_used"],
                        "last_used": v["last_used"],
                    }
                    for v in variations
                ],
            }
        )
    return jsonify(result)


@app.route("/api/categories", methods=["POST"])
def create_category():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    variations = [t.strip() for t in data.get("variations", []) if t.strip()]

    db = get_db()
    max_order = db.execute(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories"
    ).fetchone()["m"]
    color = data.get("color") or PALETTE[(max_order + 1) % len(PALETTE)]

    cur = db.execute(
        "INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)",
        (name, color, max_order + 1),
    )
    cat_id = cur.lastrowid
    for v in variations:
        db.execute(
            "INSERT INTO variations (category_id, text) VALUES (?, ?)", (cat_id, v)
        )
    db.commit()
    return jsonify({"id": cat_id}), 201


@app.route("/api/categories/<int:cat_id>", methods=["PUT"])
def update_category(cat_id):
    data = request.get_json(force=True)
    db = get_db()
    fields, values = [], []
    if "name" in data:
        fields.append("name = ?")
        values.append(data["name"].strip())
    if "color" in data:
        fields.append("color = ?")
        values.append(data["color"])
    if "sort_order" in data:
        fields.append("sort_order = ?")
        values.append(data["sort_order"])
    if fields:
        values.append(cat_id)
        db.execute(f"UPDATE categories SET {', '.join(fields)} WHERE id = ?", values)
        db.commit()
    return jsonify({"ok": True})


@app.route("/api/categories/<int:cat_id>", methods=["DELETE"])
def delete_category(cat_id):
    db = get_db()
    db.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    db.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# API: variations
# ---------------------------------------------------------------------------

@app.route("/api/categories/<int:cat_id>/variations", methods=["POST"])
def add_variation(cat_id):
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "El texto es obligatorio"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO variations (category_id, text) VALUES (?, ?)", (cat_id, text)
    )
    db.commit()
    return jsonify({"id": cur.lastrowid}), 201


@app.route("/api/variations/<int:var_id>", methods=["PUT"])
def update_variation(var_id):
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "El texto es obligatorio"}), 400
    db = get_db()
    db.execute("UPDATE variations SET text = ? WHERE id = ?", (text, var_id))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/variations/<int:var_id>", methods=["DELETE"])
def delete_variation(var_id):
    db = get_db()
    db.execute("DELETE FROM variations WHERE id = ?", (var_id,))
    db.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# API: pick a variation (the core "rotate so it doesn't repeat" logic)
# ---------------------------------------------------------------------------

@app.route("/api/categories/<int:cat_id>/pick", methods=["POST"])
def pick_variation(cat_id):
    db = get_db()
    cat = db.execute("SELECT * FROM categories WHERE id = ?", (cat_id,)).fetchone()
    if cat is None:
        return jsonify({"error": "Categoría no encontrada"}), 404

    variations = db.execute(
        "SELECT * FROM variations WHERE category_id = ?", (cat_id,)
    ).fetchall()
    if not variations:
        return jsonify({"error": "Esta categoría todavía no tiene respuestas"}), 400

    candidates = list(variations)
    # Avoid repeating the exact same variation twice in a row, if there's
    # more than one option to choose from.
    if len(candidates) > 1 and cat["last_variation_id"] is not None:
        candidates = [v for v in candidates if v["id"] != cat["last_variation_id"]] or list(variations)

    # Prefer the least-used ones (keeps rotation even over time), randomize
    # among ties so it doesn't feel mechanical.
    min_uses = min(v["times_used"] for v in candidates)
    least_used = [v for v in candidates if v["times_used"] == min_uses]
    chosen = random.choice(least_used)

    now = datetime.now().isoformat(timespec="seconds")
    db.execute(
        "UPDATE variations SET times_used = times_used + 1, last_used = ? WHERE id = ?",
        (now, chosen["id"]),
    )
    db.execute(
        "UPDATE categories SET last_variation_id = ? WHERE id = ?",
        (chosen["id"], cat_id),
    )
    db.execute(
        "INSERT INTO history (category_id, category_name, variation_id, text, sent_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (cat_id, cat["name"], chosen["id"], chosen["text"], now),
    )
    db.commit()

    return jsonify({"text": chosen["text"], "variation_id": chosen["id"]})


# ---------------------------------------------------------------------------
# API: history
# ---------------------------------------------------------------------------

@app.route("/api/history", methods=["GET"])
def get_history():
    db = get_db()
    limit = int(request.args.get("limit", 100))
    rows = db.execute(
        "SELECT * FROM history ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return jsonify(
        [
            {
                "id": r["id"],
                "category_name": r["category_name"],
                "text": r["text"],
                "sent_at": r["sent_at"],
            }
            for r in rows
        ]
    )


@app.route("/api/history/clear", methods=["POST"])
def clear_history():
    db = get_db()
    db.execute("DELETE FROM history")
    db.commit()
    return jsonify({"ok": True})


if __name__ == "__main__":
    init_db()
    print("\n  Respuestas Rápidas corriendo en: http://127.0.0.1:5050\n")
    app.run(host="127.0.0.1", port=5050, debug=False)
