import connectDB from "./db/index.js";
import Dotenv from "dotenv";
import  {app} from "./app.js";
Dotenv.config({
    path:"./env"
})
connectDB().then(
    ()=>{
        app.listen(process.env.port||8000,()=>{
            console.log(`server is running on ${process.env.PORT}`);
            
        })
    }
).then(()=>{
    app.on("errror", (error) => {
        console.log("ERRR:some problems in dbconnecction ", error);
        throw error
    })
}).catch((error)=>{
    "mongodb connection failed"
})