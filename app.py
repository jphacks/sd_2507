from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length, EqualTo
from sqlalchemy import func
from datetime import date
# 文のランダム選択に必要
import random

# Flask アプリ設定
app = Flask(__name__)
app.secret_key = "secret-key"  # CSRF対策やセッションで必須
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# DBとログイン管理
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"


# --- User モデル ---
class User(UserMixin, db.Model):
    __tablename__ = "users"   # テーブル名を明示（予約語回避）
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    total_score = db.Column(db.Integer, default=0)
    scores = db.relationship('Score', backref='users', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

score_mission = db.Table(
    'score_mission',
    db.Column('score_id', db.Integer, db.ForeignKey('score.id')),
    db.Column('mission_id', db.Integer, db.ForeignKey('mission.id'))
)

class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.now)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Integer, default=None)  # ★1〜5 の主観評価
    chew_count = db.Column(db.Integer, default=0)
    elapsed_time = db.Column(db.Integer, default=0)
    pace = db.Column(db.Integer, default=0)

    # このスコアで達成したミッションを関連付ける
    missions = db.relationship(
        'Mission',
        secondary=score_mission,
        backref=db.backref('scores', lazy='dynamic')
    )

class Mission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    check = db.Column(db.Boolean)
    content = db.Column(db.String(200), nullable=False)
    display_date = db.Column(db.Date, nullable=False, default=datetime.today) #default= datetime.today
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# --- フォーム定義 ---
class SignupForm(FlaskForm):
    username = StringField("ユーザー名", validators=[DataRequired(), Length(min=3, max=20)])
    password = PasswordField("パスワード", validators=[DataRequired(), Length(min=4)])
    confirm = PasswordField("パスワード確認", validators=[DataRequired(), EqualTo("password")])
    submit = SubmitField("登録")


class LoginForm(FlaskForm):
    username = StringField("ユーザー名", validators=[DataRequired()])
    password = PasswordField("パスワード", validators=[DataRequired()])
    submit = SubmitField("ログイン")

def get_level_info(total_score):
    """
    累計スコアから現在のレベルと、次のレベルまでの進捗率を返す。
    レベルアップに必要なスコアは、レベル^2 × 100 とする。
    """
    level = 1
    while total_score >= (level ** 2) * 100:
        level += 1

    prev_required = ((level - 1) ** 2) * 100
    next_required = (level ** 2) * 100
    progress = (total_score - prev_required) / (next_required - prev_required) * 100

    return {
        "level": level,
        "progress": progress,
        "current": total_score,
        "next_required": next_required
    }

# --- ルーティング ---
@app.route("/")
@app.route("/index")
def index():
    if current_user.is_authenticated:
        # --- 1. 今日の日付で、既にミッションがDBに存在するか確認 ---
        today = datetime.now()
        existing_missions = Mission.query.filter_by(
            user_id=current_user.id,
            display_date=today
        ).all()

        # テンプレートに渡すためのミッション内容（文字列）のリストを準備
        missions_to_display = []

        # --- 2. DBにミッションが存在した場合の処理 ---
        if existing_missions:
            # データベースのオブジェクトから内容(content)のみを抽出してリストに追加
            missions_to_display = [mission.content for mission in existing_missions]
            
        # --- 3. DBにミッションが存在しなかった場合の処理 ---
        else:
            # .txtからミッションの原文を読み込む
            try:
                with open('sentences.txt', 'r', encoding='utf-8') as f:
                    all_sentences = [line.strip() for line in f if line.strip()]
            except FileNotFoundError:
                return "sentences.txt が見つかりません。", 404
            
            # 日付を元に乱数を固定化し、5つを選択
            time_seed = today.strftime("%Y-%m-%d %H:%M") #今のところテストのため1分間固定
            user_specific_seed = f"{time_seed}-{current_user.id}"
            random.seed(str(user_specific_seed))
            
            num_to_select = min(5, len(all_sentences))
            selected_sentences_content = random.sample(all_sentences, num_to_select)
            
            # --- 4. 生成したミッションをDBに保存 ---
            for sentence in selected_sentences_content:
                # Missionオブジェクトを作成してDBセッションに追加
                new_mission = Mission(
                    content=sentence,
                    display_date=today,
                    user_id=current_user.id,
                    check=False
                )
                db.session.add(new_mission)
            
            db.session.commit() # データベースに変更を確定
            
            # 表示用リストに、生成したミッション内容をセット
            missions_to_display = selected_sentences_content

        # レベル情報を取得
        level_info = get_level_info(current_user.total_score)
        
        # 結果をテンプレートに渡して表示
        return render_template("index.html",
                               level_info=level_info,
                               active_tab="home",
                               # missions変数に文字列のリストを渡す
                               missions=missions_to_display)
    else:
        # ログインしていないユーザー向けの表示
        return render_template("index.html")

"""""""""    
def index():
    if current_user.is_authenticated:
        # レベル取得
        level_info = get_level_info(current_user.total_score)
        # .txtからミッションを読み込む
        
        now = datetime.now()
        # 一日ごとに変更する(今のところテストのため1分ごとに変更する)
        time_seed = now.strftime("%Y-%m-%d %H:%M")
        random.seed(time_seed)
        try:
            with open('sentences.txt', 'r', encoding='utf-8') as f:
                all_sentences = [line.strip() for line in f.readlines()]
        except FileNotFoundError:
            return "sentences.txt が見つかりません。", 404
        num_to_select = min(5, len(all_sentences))
        selected_sentences = random.sample(all_sentences, num_to_select)
        
        return render_template("index.html",  level_info=level_info, active_tab="home", sentences = selected_sentences)
    else:
        return render_template("index.html")
"""""""""

from datetime import date
from sqlalchemy import func

@app.context_processor
def inject_missions():
    missions = []
    try:
        if current_user.is_authenticated:
            # DB上の display_date の日付部分が今日のものを取得
            today = date.today()
            todays = Mission.query.filter(
                Mission.user_id == current_user.id,
                func.date(Mission.display_date) == today
            ).order_by(Mission.id.desc()).limit(5).all()
            # missions = [m.content for m in todays]
            missions = todays
            missions.reverse()  # ID降順で取得しているので表示用に逆順にする
    except Exception:
        # 安全のため何か失敗してもテンプレート崩れしないよう空リストを返す
        missions = []
    return dict(missions=missions)


@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/result", methods=["GET", "POST"])
@login_required
def result():
    if request.method == "POST":
        # JS側から送られた統計データと評価を取得
        value = request.form.get("value", type=int)
        chew_count = request.form.get("chewCount", type=int)
        elapsed_time = request.form.get("elapsedTime", type=int)
        pace = request.form.get("pace", type=int)
        rating = request.form.get("rating", type=int)

        # スコア登録
        new_score = Score(
            value=value,
            chew_count=chew_count,
            elapsed_time=elapsed_time,
            pace=pace,
            rating=rating,
            user_id=current_user.id,
            timestamp=datetime.now()
        )
        
        # ミッション達成処理
        mission_ids = request.form.getlist("mission_ids")
        if mission_ids:
            missions = Mission.query.filter(
                Mission.id.in_(mission_ids),
                Mission.user_id == current_user.id
            ).all()
            for m in missions:
                m.check = True  # 達成済みに更新
                current_user.total_score += 200
                new_score.missions.append(m)
        
        # totalスコア更新
        current_user.total_score += value
        db.session.add(new_score)
        db.session.commit()

        flash("記録が登録されました！", "success")
        return redirect(url_for("history"))

    # GET時: JSで送信前のプレビュー表示
    return render_template("result.html")

@app.route("/history")
@login_required
def history():
    # クエリパラメータ ?filter=morning / afternoon / evening
    filter_type = request.args.get("filter", "all")

    query = Score.query.filter_by(user_id=current_user.id)

    # 時間帯フィルタ
    if filter_type == "morning":
        query = [s for s in query.all() if 5 <= s.timestamp.hour < 12]
    elif filter_type == "afternoon":
        query = [s for s in query.all() if 12 <= s.timestamp.hour < 18]
    elif filter_type == "evening":
        query = [s for s in query.all() if s.timestamp.hour >= 18 or s.timestamp.hour < 5]
    else:
        query = query.order_by(Score.timestamp.desc()).all()

    return render_template("history.html", scores=query, active_tab="history", filter_type=filter_type)

@app.route("/profile")
def profile():
    return render_template("profile.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")

# テスト用
@app.route("/chewtest")
def chew_test():
    return render_template("chew_test.html")

@app.route("/test")
def test():
    return render_template("animation_test.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    form = SignupForm()
    if form.validate_on_submit():
        if User.query.filter_by(username=form.username.data).first():
            flash("このユーザー名は既に使われています", "warning")
            return redirect(url_for("signup"))

        new_user = User(username=form.username.data)
        new_user.set_password(form.password.data)
        db.session.add(new_user)
        db.session.commit()

        flash("登録完了！ログインしてください", "success")
        return redirect(url_for("login"))

    return render_template("signup.html", form=form)


@app.route("/login", methods=["GET", "POST"])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            flash("ログインしました", "success")
            return redirect(url_for("index"))
        else:
            flash("ユーザー名またはパスワードが違います", "danger")
    return render_template("login.html", form=form)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("ログアウトしました", "info")
    return redirect(url_for("index"))


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)