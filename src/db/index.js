import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB=async()=>{
    try {
       const connectionInstance= await  mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    console.log(`\n mongodb connected ${connectionInstance.connection.host } ${process.env.PORT}`);
    
    } catch (error) {
       console.log("mongodb connection",error);
        process.exit(1);
    }
}
export default connectDB;