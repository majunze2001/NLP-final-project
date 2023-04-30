import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.metrics import classification_report
import nltk
from nltk.corpus import wordnet as wn
import math
from collections import Counter
from sklearn.model_selection import GridSearchCV
import re
from joblib import dump, load
import string

model_rf = load('../model_rf.joblib')
model_lr = load('../model_lr.joblib')
model_svm = load('../model_svm.joblib')

# features functions
# Feature extraction functions
def sentence_length(text):
    text = str(text)
    sentences = nltk.sent_tokenize(text)
    numberofsentences = len(sentences)
    total_words = 0
    for i in sentences:
        total_words += len(i.split())
    avg_sentence = total_words / numberofsentences
    return numberofsentences, avg_sentence

def repetitivewords(text):
    text = str(text)
    token = nltk.word_tokenize(text.lower())
    synsets = []
    for i in token:
        synsets.extend(wn.synsets(i))
    synonyms = []
    for synset in synsets:
        synonyms.append([lemma.name() for lemma in synset.lemmas()])
    repeat = 0
    for index in range(len(synonyms)):
        for nextindex in range(index+1, len(synonyms)):
            if len(set(synonyms[index]) & set(synonyms[nextindex])) > 0:
                repeat += 1
    return repeat / len(token)

def entropy(text):
    text = str(text)
    tokens = nltk.word_tokenize(text.lower())
    tokennumber = Counter(tokens)
    total = len(tokens)
    numberofprobs = []
    for count in tokennumber.values():
        prob = count / total
        numberofprobs.append(prob)
    entropy = 0.0
    for i in numberofprobs:
        if i > 0:
            entropy -= i * (math.log(i, 2))
    return entropy

def count_punctuation(text):
     text = str(text)
     sentences = nltk.sent_tokenize(text)
     numberofsentences = len(sentences)
     count = 0
     for char in text:
          if char in string.punctuation:
              count += 1
     return count / numberofsentences if numberofsentences > 0 else 0

def count_numbers(text):
    count = len(list(filter(lambda w: any([c.isdigit() for c in w]), text.split())))
    num_sentences = len(nltk.sent_tokenize(text))
    return count / num_sentences if num_sentences > 0 else 0


def predict_one(s, model, tfidf_transformer):
    tfidf_transformer = TfidfVectorizer()
    # Extract features
    _, avg_sent_length = sentence_length(s)  # We only need the average sentence length
    repetitive_words = repetitivewords(s)
    text_entropy = entropy(s)
    punctuation_count = count_punctuation(s)
    number_count = count_numbers(s)

    # Transform the input string into a TF-IDF vector
    s_tfidf = tfidf_transformer.transform([s])

    # Combine the TF-IDF vector with the extracted features
    s_features = np.array([avg_sent_length, repetitive_words, text_entropy, punctuation_count, number_count]).reshape(1, -1)
    s_combined = np.hstack((s_tfidf.toarray(), s_features))

    # Make a prediction using the model
    prediction = model.predict(s_combined)

    return prediction

# Test the function with a sample string and the SVM model
def predict_string(s):
    svm = predict_one(s, model_svm)
    rf = predict_one(s, model_rf)
    lr = predict_one(s, model_lr)
    return [svm, rf, lr]


