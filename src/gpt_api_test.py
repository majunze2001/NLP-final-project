import key
import openai
openai.api_key = key.api_key
res = response = openai.Completion.create(model="text-davinci-003", prompt="Tell me something")
# res = openai.ChatCompletion.create(
#   model="gpt-3.5-turbo",
#   messages=[
#         {"role": "user", "content": "Tell me something"},
#     ]
# )
print(res)