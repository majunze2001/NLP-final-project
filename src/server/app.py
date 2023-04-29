from flask import Flask, request
from predict import predict_string 

app = Flask(__name__)

@app.route("/")
def hello_world():
    text = request.args.get('query')
    print(text)
    return f"<p>Hello, World! {predict_string(text)}</p>"


@app.route("/predict")
def predict():
    text = request.args.get('query')
    print(text)
    return f"<p>Hello, World! {predict_string(text)}</p>"