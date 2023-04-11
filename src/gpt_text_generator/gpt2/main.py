from transformers import pipeline, set_seed
import random
generator = pipeline('text-generation', model='gpt2')
count = 0
with open("titles_old.txt") as f:
    titles = list(map(lambda t: t.strip(), f.readlines()))
    for t in titles:
        count+=1
        set_seed(int(random.random() * 100 ))
        query = "Kick off the new year right and pick up the brand-new Smarter Living book! We've pulled together the best of S.L., plus loads of new advice and guidance, to give you smart, actionable life tips on how to improve your career, your home, your finances, your relationships and your health — all wrapped up in a truly gorgeous book perfect for New Year, New You resolutions."
        # textDict = generator(f"Article Title: {t}\n Content:", max_length=500, num_return_sequences=1)
        textDict = generator(query, max_length=500, num_return_sequences=1)
        texts = [t["generated_text"] for t in textDict]
        # with open(f"data/{count}.txt", "w") as f:
        #     for t in texts:
        #         f.write(t)
        #         f.write('\n')
        print(texts[0])
        break