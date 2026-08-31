const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;

const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const fallback = {
  reports: [
    {id:1, unit:"Tiểu đoàn 3", content:"Tình hình học tập và rèn luyện cơ bản ổn định.", proposal:"Tiếp tục tăng cường hướng dẫn kỹ năng số.", created_at:new Date().toISOString()}
  ],
  propaganda: [
    {id:1,title:"Chuyển đổi số",category:"Chuyển đổi số",content:"Nâng cao năng lực số giúp học viên khai thác hiệu quả công nghệ trong học tập, công tác và quản lý."},
    {id:2,title:"An toàn thông tin",category:"An toàn thông tin",content:"Kiểm tra nguồn tin, bảo vệ tài khoản, không mở liên kết hoặc tệp tin không rõ nguồn gốc."},
    {id:3,title:"AI trong học tập",category:"AI",content:"AI là công cụ hỗ trợ; người sử dụng phải kiểm tra, chọn lọc và chịu trách nhiệm về nội dung sử dụng."},
    {id:4,title:"Kỷ luật số",category:"Kỷ luật số",content:"Tuân thủ quy định khi sử dụng thiết bị, mạng Internet và các nền tảng số; bảo vệ thông tin của đơn vị."}
  ],
  situations: [
    {id:1,title:"Thông tin sai lệch trên môi trường mạng",steps:["Xác minh nguồn tin và mức độ ảnh hưởng.","Không vội chia sẻ khi chưa xác minh.","Báo cáo người có trách nhiệm và sử dụng nguồn chính thống.","Lưu bằng chứng cần thiết, rút kinh nghiệm."]},
    {id:2,title:"Vi phạm nội quy, quy định",steps:["Tiếp nhận thông tin khách quan.","Xác minh người, việc, thời gian và nguyên nhân.","Giáo dục, nhắc nhở hoặc đề xuất xử lý đúng thẩm quyền.","Theo dõi kết quả và báo cáo khi cần."]},
    {id:3,title:"Học tập, rèn luyện chưa đạt yêu cầu",steps:["Nắm tình hình và xác định nguyên nhân.","Trao đổi trực tiếp, xác định khó khăn.","Đề ra biện pháp hỗ trợ và mốc kiểm tra.","Theo dõi tiến bộ và điều chỉnh biện pháp."]}
  ]
};

async function initDb(){
  if(!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports(
      id SERIAL PRIMARY KEY, unit TEXT NOT NULL, content TEXT NOT NULL,
      proposal TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS propaganda(
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS situations(
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, steps JSONB NOT NULL
    );
  `);
  const c = await pool.query("SELECT COUNT(*)::int AS n FROM propaganda");
  if(c.rows[0].n === 0){
    for(const x of fallback.propaganda) await pool.query("INSERT INTO propaganda(title,category,content) VALUES($1,$2,$3)",[x.title,x.category,x.content]);
  }
  const s = await pool.query("SELECT COUNT(*)::int AS n FROM situations");
  if(s.rows[0].n === 0){
    for(const x of fallback.situations) await pool.query("INSERT INTO situations(title,steps) VALUES($1,$2)",[x.title,JSON.stringify(x.steps)]);
  }
}

app.get("/api/health", (req,res)=>res.json({success:true,status:"online",database:!!pool}));
app.get("/api/dashboard", async (req,res)=>{
  if(!pool) return res.json({reports:fallback.reports.length,propaganda:fallback.propaganda.length,situations:fallback.situations.length,database:false});
  const [r,p,s] = await Promise.all([
    pool.query("SELECT COUNT(*)::int n FROM reports"),
    pool.query("SELECT COUNT(*)::int n FROM propaganda"),
    pool.query("SELECT COUNT(*)::int n FROM situations")
  ]);
  res.json({reports:r.rows[0].n,propaganda:p.rows[0].n,situations:s.rows[0].n,database:true});
});
app.get("/api/reports", async (req,res)=>{
  if(!pool) return res.json(fallback.reports);
  const q=await pool.query("SELECT * FROM reports ORDER BY created_at DESC LIMIT 50"); res.json(q.rows);
});
app.post("/api/reports", async (req,res)=>{
  const {unit,content,proposal=""}=req.body;
  if(!unit || !content) return res.status(400).json({error:"Thiếu đơn vị hoặc nội dung"});
  if(!pool){
    const item={id:Date.now(),unit,content,proposal,created_at:new Date().toISOString()};
    fallback.reports.unshift(item); return res.status(201).json(item);
  }
  const q=await pool.query("INSERT INTO reports(unit,content,proposal) VALUES($1,$2,$3) RETURNING *",[unit,content,proposal]);
  res.status(201).json(q.rows[0]);
});
app.get("/api/propaganda", async (req,res)=>{
  if(!pool) return res.json(fallback.propaganda);
  const q=await pool.query("SELECT * FROM propaganda ORDER BY id"); res.json(q.rows);
});
app.get("/api/situations", async (req,res)=>{
  if(!pool) return res.json(fallback.situations);
  const q=await pool.query("SELECT * FROM situations ORDER BY id"); res.json(q.rows);
});
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

initDb().then(()=>app.listen(PORT,"0.0.0.0",()=>console.log(`CTCT So server on ${PORT}`)))
.catch(err=>{console.error(err); process.exit(1);});
