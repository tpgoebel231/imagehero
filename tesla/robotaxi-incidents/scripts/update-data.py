import pandas as pd
import json

def update_data():
    input_file = 'SGO-2021-01_ADS.csv'
    output_file = 'incidents.json'

    # Read and filter
    df = pd.read_csv(input_file)
    df = df[df['Reporting Entity'].isin(['Waymo LLC', 'Tesla, Inc.'])].copy()

    # Reconstruct stories for Tesla (since they are redacted in the raw file)
    def reconstruct_story(row):
        if row['Reporting Entity'] == 'Tesla, Inc.':
            mvmt = str(row['SV Pre-Crash Movement']).lower()
            obj = str(row['Crash With']).lower()
            return f"REDACTED BY MANUFACTURER. Inferred: Tesla vehicle was {mvmt} when it hit {obj}."
        return row['Narrative']

    df['display_text'] = df.apply(reconstruct_story, axis=1)

    # Save lightweight JSON
    df[['Report ID', 'Reporting Entity', 'City', 'display_text']].to_json(output_file, orient='records')

if __name__ == "__main__":
    update_data()