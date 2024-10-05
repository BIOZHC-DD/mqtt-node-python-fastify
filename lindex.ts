import fs from 'fs';
import { parse } from 'csv-parse/sync';

export async function sendJsonToPythonServer(sessionId: number, modelId: number, csvContent: any): {
  const url = "http://localhost:8000";
  
  try {
    // Determine the CSV file name based on the session ID
    const csvFileName = `output${sessionId}.csv`;
    
    // Read the CSV file
    const csvData = fs.readFileSync(csvFileName, 'utf-8');
    
    // Parse CSV data
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    // Convert CSV data to JSON
    const jsonData = {
      csvContent: records,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      modelId: modelId
    };

    // Send data to Python server
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonData),
    });

    if (response.ok) {
      const responseText = await response.text();
      console.log("Server response:", responseText);
    } else {
      console.error("Error:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}
