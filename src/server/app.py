from flask import Flask, request, render_template,redirect, url_for
from predict import predict_string 

app = Flask(__name__)



@app.route('/')
def home():
    """
    Route for the home page
    """
    return render_template('index.html')


@app.route('/', methods=['POST'])
def predict():
    text = request.form['text'].strip()
    results = predict_string(text)
    print(results)
    return render_template('index.html', results = results)
