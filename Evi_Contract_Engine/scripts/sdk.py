from acad_sdk import AcadClient

client = AcadClient()  # uses default Railway API and defaults
job_id = client.start_pipeline_auto(prompt="ERC721 with minting")
final = client.wait_for_completion(job_id, stream_logs=True)
print("Final:", final)

sources = client.get_sources(job_id)