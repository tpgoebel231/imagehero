import pandas as pd
import json
import os

def update_data():
    # --- CONFIGURATION ---
    # These paths assume the script is running from the ROOT folder
    input_file = 'data/SGO-2021-01_Incident_Reports_ADS.csv'
    output_file = 'data/incidents.json'

    print(f"Reading from: {input_file}")

    # Check if file exists before crashing
    if not os.path.exists(input_file):
        print(f"❌ Error: Could not find '{input_file}'.")
        print("   Make sure you moved the CSV file into the 'data' folder!")
        return

    try:
        df = pd.read_csv(input_file)
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return

    # Filter for Waymo and Tesla only
    df = df[df['Reporting Entity'].isin(['Waymo LLC', 'Tesla, Inc.'])].copy()

    # --- DATA CLEANING ---
    # 1. Clean Dates (Format YYYY-MM-DD)
    df['Incident Date'] = pd.to_datetime(df['Incident Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    
    # 2. Clean City Names (Title Case + Handle Empty)
    df['City'] = df['City'].astype(str).str.strip().str.title()
    df['City'] = df['City'].replace(['Nan', 'nan', ''], 'Unknown')

    # --- STORY GENERATION ---
    def process_narrative(row):
        entity = row['Reporting Entity']
        
        # Scenario A: Tesla (Redacted) -> We construct the story
        if entity == 'Tesla, Inc.':
            # Clean up the fields to make them sound natural in a sentence
            movement = str(row['SV Pre-Crash Movement']).lower().replace('nan', 'moving')
            roadway = str(row['Roadway Type']).lower().replace('nan', 'road')
            crash_with = str(row['Crash With']).lower().replace('nan', 'object')
            city = str(row['City'])
            
            # The "Mad Libs" sentence
            inferred_text = f"A Tesla vehicle was {movement} on a {roadway} in {city} when it collided with a {crash_with}."
            
            return {
                "display": f"[REDACTED BY MANUFACTURER]\n\nInferred Scenario: {inferred_text}",
                "is_redacted": True
            }
            
        # Scenario B: Waymo (Transparent) -> We use the actual text
        else:
            return {
                "display": row['Narrative'],
                "is_redacted": False
            }

    # Apply the logic row by row
    narrative_data = df.apply(process_narrative, axis=1)
    
    # Split the results back into columns
    df['narrative_text'] = [x['display'] for x in narrative_data]
    df['is_redacted'] = [x['is_redacted'] for x in narrative_data]

    # --- OUTPUT FORMATTING ---
    # Select only the columns the website needs (keeps file size small)
    output_df = pd.DataFrame({
        'id': df['Report ID'],
        'entity': df['Reporting Entity'],
        'date': df['Incident Date'],
        'city': df['City'],
        'state': df['State'],
        'crash_with': df['Crash With'],
        'movement': df['SV Pre-Crash Movement'],
        'severity': df['Highest Injury Severity Alleged'],
        'narrative': df['narrative_text'],
        'redacted': df['is_redacted']
    })

    # Sort by date (Newest first)
    output_df = output_df.sort_values(by='date', ascending=False)
    
    # Fill any remaining empty values with a string so JSON doesn't break
    output_df = output_df.fillna("Unknown")

    # --- SAVE TO JSON ---
    output_df.to_json(output_file, orient='records', indent=2)
    print(f"✅ Success! Processed {len(output_df)} incidents.")
    print(f"   Saved to: {output_file}")

if __name__ == "__main__":
    update_data()