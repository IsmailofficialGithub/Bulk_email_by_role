const pc = require("picocolors");
const { supabase } = require("../config/supabase");

class ExecutionLogger {
  constructor(userId, jobType) {
    this.userId = userId;
    this.jobType = jobType;
    this.logId = null;
    this.logs = [];
    this.status = "running";
    this.message = `Starting ${jobType} job...`;
    this.summaryDetails = {};
    
    // Fallback for console logging just in case
    this.logToConsole = true;
  }

  // Format current time nicely for logs
  _timeString() {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  async start(initialMessage) {
    this.message = initialMessage;
    const logLine = `[${this._timeString()}] [INFO] ${initialMessage}`;
    this.logs.push(logLine);
    
    if (this.logToConsole) {
      console.log(pc.bgBlue(pc.white(` [${this.jobType.toUpperCase()}] ${initialMessage} `)));
    }
    
    try {
      let res = await supabase
        .from("automailsend_execution_logs")
        .insert([{ 
          user_id: this.userId, 
          status: this.status, 
          message: this.message, 
          details: { jobType: this.jobType, logs: this.logs } 
        }])
        .select("id")
        .single();
      
      if (res.error) throw res.error;
      if (res.data) this.logId = res.data.id;
    } catch (err) {
      console.error(pc.bgRed(pc.white(` [DB LOG ERROR] Failed to create log: ${err.message} `)));
    }
  }

  async append(level, msg) {
    const logLine = `[${this._timeString()}] [${level}] ${msg}`;
    this.logs.push(logLine);
    
    if (this.logToConsole) {
      if (level === 'ERROR') console.error(pc.red(` ✖ ${msg}`));
      else if (level === 'WARN') console.log(pc.yellow(` ⚠️ ${msg}`));
      else if (level === 'SUCCESS') console.log(pc.green(` ✔ ${msg}`));
      else console.log(pc.cyan(` ➜ ${msg}`));
    }

    await this._updateDb();
  }

  async finish(status, summaryMessage, summaryDetails = {}) {
    this.status = status;
    this.message = summaryMessage;
    this.summaryDetails = summaryDetails;
    
    const level = status === 'success' ? 'SUCCESS' : status === 'error' ? 'ERROR' : 'INFO';
    const logLine = `[${this._timeString()}] [${level}] ${summaryMessage}`;
    this.logs.push(logLine);
    
    if (this.logToConsole) {
      if (status === 'success') console.log(pc.bgGreen(pc.black(` ✔ ${summaryMessage} `)));
      else if (status === 'error') console.log(pc.bgRed(pc.white(` ✖ ${summaryMessage} `)));
    }

    await this._updateDb();
  }

  async _updateDb() {
    if (!this.logId) return;
    try {
      await supabase
        .from("automailsend_execution_logs")
        .update({ 
          status: this.status, 
          message: this.message, 
          details: { jobType: this.jobType, logs: this.logs, ...this.summaryDetails } 
        })
        .eq("id", this.logId);
    } catch (err) {
      console.error(pc.bgRed(pc.white(` [DB LOG ERROR] Failed to update log: ${err.message} `)));
    }
  }
}

module.exports = { ExecutionLogger };
