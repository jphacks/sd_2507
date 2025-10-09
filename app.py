from flask import Flask, render_template, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length, EqualTo

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

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


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


# --- ルーティング ---
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/profile")
def profile():
    return render_template("profile.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")

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