import pandas as pd
import json
import os

def update_data():
    # --- PATHS ---
    # Ensure this matches your actual file name in the /data folder
    input_file = 'data/SGO-2021-01_Incident_Reports_ADS.csv' 
    output_file = 'data/incidents.json'

    print(f"📂 Reading: {input_file}")
    
    if not os.path.exists(input_file):
        print(f"❌ Error: File not found at {input_file}")
        return

    try:
        df = pd.read_csv(input_file)
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return

    # --- DIAGNOSTIC PRINT ---
    # This helps us see what companies are actually in the file
    print("   ...Found these entities in your CSV:", df['Reporting Entity'].unique())

    # --- ROBUST FILTERING ---
    # Instead of exact match, we look for the string "Tesla" or "Waymo" (case insensitive)
    df = df[df['Reporting Entity'].str.contains('Waymo|Tesla', case=False, na=False)].copy()
    
    # Check counts
    tesla_count = len(df[df['Reporting Entity'].str.contains('Tesla', case=False)])
    waymo_count = len(df[df['Reporting Entity'].str.contains('Waymo', case=False)])
    print(f"   ...Filtered down to: {tesla_count} Tesla rows, {waymo_count} Waymo rows.")

    if tesla_count == 0:
        print("⚠️  WARNING: No Tesla rows found! Check the entity names printed above.")

    # --- DATA CLEANING ---
    df['Incident Date'] = pd.to_datetime(df['Incident Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    df['City'] = df['City'].astype(str).str.strip().str.title()
    df['City'] = df['City'].replace(['Nan', 'nan', '', 'N/A'], 'Unknown')

    # --- STORY GENERATION ---
    def process_narrative(row):
        # Flexible check: does the name contain "Tesla"?
        entity_str = str(row['Reporting Entity'])
        
        if "Tesla" in entity_str:
            movement = str(row['SV Pre-Crash Movement']).lower().replace('nan', 'moving')
            roadway = str(row['Roadway Type']).lower().replace('nan', 'road')
            crash_with = str(row['Crash With']).lower().replace('nan', 'object')
            city = str(row['City'])
            
            inferred_text = f"A Tesla vehicle was {movement} on a {roadway} in {city} when it collided with a {crash_with}."
            
            return {
                "display": f"[REDACTED BY MANUFACTURER]\n\nInferred Scenario: {inferred_text}",
                "is_redacted": True
            }
        else:
            return {
                "display": row['Narrative'],
                "is_redacted": False
            }

    narrative_data = df.apply(process_narrative, axis=1)
    df['narrative_text'] = [x['display'] for x in narrative_data]
    df['is_redacted'] = [x['is_redacted'] for x in narrative_data]

    # --- OUTPUT ---
    output_df = pd.DataFrame({
        'id': df['Report ID'],
        'entity': df['Reporting Entity'], # Keep original name
        'date': df['Incident Date'],
        'city': df['City'],
        'state': df['State'],
        'crash_with': df['Crash With'],
        'movement': df['SV Pre-Crash Movement'],
        'severity': df['Highest Injury Severity Alleged'],
        'narrative': df['narrative_text'],
        'redacted': df['is_redacted']
    })

    output_df = output_df.sort_values(by='date', ascending=False).fillna("Unknown")
    output_df.to_json(output_file, orient='records', indent=2)
    print(f"✅ Success! Saved {len(output_df)} total incidents to {output_file}")

if __name__ == "__main__":
    update_data()