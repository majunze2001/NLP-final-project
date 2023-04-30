#!/usr/bin/env python
# coding: utf-8

# ### Imports

# In[8]:
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
import string
from joblib import dump, load
from sklearn.metrics import confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from nltk import FreqDist
from nltk import bigrams, trigrams
from nltk import pos_tag
from nltk.tokenize import word_tokenize
from pathlib import Path


# ### Global Varaibles

# In[9]:


# global varibles
SAVE = False
# Load data

gpt_data_files = ['small-117M', 'medium-345M', 'large-762M', 'xl-1542M', 'turbo']
# Sample
SAMPLE_NUMBER = 5000
result_path = Path('.', 'results')
if not result_path.exists():
    result_path.mkdir()


# ### Feature extraction functions

# In[11]:


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


# ### Training
def training(gpt_data_filename):
    human_data = pd.read_csv("data_process/human.csv")
    gpt_data = pd.read_csv(f"data_process/{gpt_data_filename}.csv")
    result_file = result_path / f"{gpt_data_filename}.txt"
    outfile = result_file.open('w')
    

    # Take a random sample of instances from each dataset
    gpt_data = gpt_data.sample(SAMPLE_NUMBER, random_state=1)
    human_data = human_data.sample(SAMPLE_NUMBER, random_state=1)

    # Combine the two datasets into one
    data = pd.concat([gpt_data, human_data], ignore_index=True)
    data = data.sample(frac=1)

    # Extract features
    data['sent_length'], data['avg_sent_length'] = zip(*data['text'].apply(sentence_length))
    data['repetitive_words'] = data['text'].apply(repetitivewords)
    data['text_entropy'] = data['text'].apply(entropy)
    # Compute the new features
    data['punctuation_count'] = data['text'].apply(count_punctuation)
    data['number_count'] = data['text'].apply(count_numbers)


    # Split data into training and testing sets
    X = data.drop(columns=['generated'])
    X = X.drop(columns=['sent_length'])
    y = data['generated']

    # Split data into training, validation, and testing sets
    X_temp, X_test, y_temp, y_test = train_test_split(X, y, test_size=0.15, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=0.1765, random_state=42)

    # Fill NaN values with an empty string
    X_train['text'] = X_train['text'].fillna('')
    X_val['text'] = X_val['text'].fillna('')
    X_test['text'] = X_test['text'].fillna('')

    # Extract TF-IDF features
    tfidf = TfidfVectorizer()
    X_train_tfidf = tfidf.fit_transform(X_train['text'])
    X_val_tfidf = tfidf.transform(X_val['text'])
    X_test_tfidf = tfidf.transform(X_test['text'])

    # Store the extracted TF-IDF features
    X_train['tfidf'] = list(X_train_tfidf.toarray())
    X_val['tfidf'] = list(X_val_tfidf.toarray())
    X_test['tfidf'] = list(X_test_tfidf.toarray())


    # Combine TF-IDF features with the extracted features
    X_train_features = X_train.drop(columns=['text']).to_numpy()
    X_val_features = X_val.drop(columns=['text']).to_numpy()
    X_test_features = X_test.drop(columns=['text']).to_numpy()

    # Combine TF-IDF features with the scaled extracted features
    # Prepare the feature matrix
    X_train_combined = np.column_stack((X_train['avg_sent_length'].values,
                                        X_train['repetitive_words'].values,
                                        X_train['text_entropy'].values,
                                        X_train['punctuation_count'].values,
                                        X_train['number_count'].values,
                                        X_train_tfidf.toarray()))

    X_val_combined = np.column_stack((X_val['avg_sent_length'].values,
                                    X_val['repetitive_words'].values,
                                    X_val['text_entropy'].values,
                                    X_val['punctuation_count'].values,
                                    X_val['number_count'].values,
                                    X_val_tfidf.toarray()))

    X_test_combined = np.column_stack((X_test['avg_sent_length'].values,
                                    X_test['repetitive_words'].values,
                                    X_test['text_entropy'].values,
                                    X_test['punctuation_count'].values,
                                    X_test['number_count'].values,
                                    X_test_tfidf.toarray()))


    # Perform Grid Search for optimal parameters
    rf_params = {'n_estimators': [50, 100],
                'max_depth': [None, 30]}
    lr_params = {'C': [0.1, 1, 10],
                'solver': ['newton-cg', 'liblinear']}
    svm_params = {'C': [1, 10],
                'kernel': ['linear', 'rbf']}


    model_rf = RandomForestClassifier(random_state=42, verbose=1)
    model_lr = LogisticRegression(random_state=42, max_iter=1000, verbose=1)
    model_svm = SVC(random_state=42, verbose=1)

    grid_rf = GridSearchCV(model_rf, rf_params, cv=5, verbose=1)
    grid_rf.fit(X_val_combined, y_val)
    best_rf_params = grid_rf.best_params_

    grid_lr = GridSearchCV(model_lr, lr_params, cv=5, verbose=1)
    grid_lr.fit(X_val_combined, y_val)
    best_lr_params = grid_lr.best_params_

    grid_svm = GridSearchCV(model_svm, svm_params, cv=5, verbose=1)
    grid_svm.fit(X_val_combined, y_val)
    best_svm_params = grid_svm.best_params_

    # Train models with optimal parameters
    model_rf = RandomForestClassifier(**best_rf_params, random_state=42, verbose=1)
    model_rf.fit(X_train_combined, y_train)

    model_lr = LogisticRegression(**best_lr_params, random_state=42, max_iter=1000, verbose=1)
    model_lr.fit(X_train_combined, y_train)

    model_svm = SVC(**best_svm_params, random_state=42, verbose=1)
    model_svm.fit(X_train_combined, y_train)

    if SAVE:
        dump(model_rf, 'model_rf.joblib')
        dump(model_lr, 'model_lr.joblib')
        dump(model_svm, 'model_svm.joblib')
        dump(tfidf, 'tfidf_transformer.joblib')

    # Model evaluation
    models = {'Random Forest': model_rf,
            'Logistic Regression': model_lr,
            'SVM': model_svm}
    for name, model in models.items():
        y_pred_train = model.predict(X_train_combined)  # Predict the labels for the training data
        train_report = classification_report(y_train, y_pred_train, output_dict=True)

        train_precision = train_report['macro avg']['precision']
        train_recall = train_report['macro avg']['recall']
        train_f_measure = train_report['macro avg']['f1-score']
        train_accuracy = train_report['accuracy']

        outfile.write("{} Train Evaluation:\n".format(name))
        outfile.write("  Precision: {:.5f}\n".format(train_precision))
        outfile.write("  Recall: {:.5f}\n".format(train_recall))
        outfile.write("  F-measure: {:.5f}\n".format(train_f_measure))
        outfile.write("  Accuracy: {:.5f}\n".format(train_accuracy))

        y_pred_test = model.predict(X_test_combined)  # Predict the labels for the testing data
        test_report = classification_report(y_test, y_pred_test, output_dict=True)

        test_precision = test_report['macro avg']['precision']
        test_recall = test_report['macro avg']['recall']
        test_f_measure = test_report['macro avg']['f1-score']
        test_accuracy = test_report['accuracy']

        outfile.write("{} Test Evaluation:\n".format(name))
        outfile.write("  Precision: {:.5f}\n".format(test_precision))
        outfile.write("  Recall: {:.5f}\n".format(test_recall))
        outfile.write("  F-measure: {:.5f}\n".format(test_f_measure))
        outfile.write("  Accuracy: {:.5f}\n".format(test_accuracy))

    # ### Evaluation

    for name, model in models.items():
        y_pred_test = model.predict(X_test_combined)  # Predict the labels for the testing data

        cm_test = confusion_matrix(y_test, y_pred_test)

        # Test evaluation
        TP_test, FP_test, TN_test, FN_test = cm_test[1, 1], cm_test[0, 1], cm_test[0, 0], cm_test[1, 0]
        precision_positive_test = TP_test / (TP_test + FP_test)
        recall_positive_test = TP_test / (TP_test + FN_test)
        precision_negative_test = TN_test / (TN_test + FN_test)
        recall_negative_test = TN_test / (TN_test + FP_test)

        f_measure_positive_test = 2 * (precision_positive_test * recall_positive_test) / (precision_positive_test + recall_positive_test)
        f_measure_negative_test = 2 * (precision_negative_test * recall_negative_test) / (precision_negative_test + recall_negative_test)

        outfile.write("{} Test Evaluation:\n".format(name))
        outfile.write("  Positive Class:\n")
        outfile.write("    Precision: {:.3f}\n".format(precision_positive_test))
        outfile.write("    Recall: {:.3f}\n".format(recall_positive_test))
        outfile.write("    F-measure: {:.3f}\n".format(f_measure_positive_test))
        outfile.write("  Negative Class:\n")
        outfile.write("    Precision: {:.3f}\n".format(precision_negative_test))
        outfile.write("    Recall: {:.3f}\n".format(recall_negative_test))
        outfile.write("    F-measure: {:.3f}\n".format(f_measure_negative_test))


    outfile.close()


for n in gpt_data_files:
    training(n)