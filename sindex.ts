//export async function sendJsonToPythonServer() {
//  const url = "http://localhost:8000";
//  const data = {
//    message: "Hello from TypeScript!",
//    timestamp: new Date().toISOString(),
//  };
//
//  try {
//    const response = await fetch(url, {
//      method: "POST",  // Ensure this is POST, not GET
//      headers: {
//        "Content-Type": "application/json",
//      },
//      body: JSON.stringify(data),
//    });
//
//    if (response.ok) {
//      const responseText = await response.text();
//      console.log("Server response:", responseText);
//    } else {
//      console.error("Error:", response.status, response.statusText);
//    }
//  } catch (error) {
//    console.error("Fetch error:", error);
//  }
//}
//
//
//




















// this is the perfectly working code that i have written, don't touch it much 
//import fs from 'fs';
//import { parse } from 'csv-parse/sync';
//
//export async function sendJsonToPythonServer() {
//  const url = "http://localhost:8000";
//  
//  try {
//    // Read the CSV file
//    const csvData = fs.readFileSync('output1.csv', 'utf-8');
//    
//    // Parse CSV data
//    const records = parse(csvData, {
//      columns: true,
//      skip_empty_lines: true
//    });
//
//    // Convert CSV data to JSON
//    const jsonData = {
//      csvContent: records,
//      timestamp: new Date().toISOString(),
//    };
//
//    // Send data to Python server
//    const response = await fetch(url, {
//      method: "POST",
//      headers: {
//        "Content-Type": "application/json",
//      },
//      body: JSON.stringify(jsonData),
//    });
//
//    if (response.ok) {
//      const responseText = await response.text();
//      console.log("Server response:", responseText);
//    } else {
//      console.error("Error:", response.status, response.statusText);
//    }
//  } catch (error) {
//    console.error("Error:", error);
//  }
//}
//
//
//
//


import fs from 'fs';
import { parse } from 'csv-parse/sync';

export async function sendJsonToPythonServer(sessionId: number, modelId: number) {
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
