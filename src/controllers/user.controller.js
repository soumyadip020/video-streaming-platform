import {asyncHandler} from "../utils/asyncHandler.js" 
import ApiError from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import ApiResponse from "../utils/ApiResponse.js"

const generateAccessAndrefreshTokens =async(userId)=>{
  try {
     const user=await User.findById(userId)
    const accessToken= user.generateRefreshToken()
     const refreshToken= user.generateAccessToken()
    
user.refreshToken=refreshToken//saves to the database
 await user.save({validateBeforeSave:false})//parameter 

return {accessToken,refreshToken}
  } catch (error) {
    throw new ApiError(500,"something went wrong while generating refresh and access token")
  }
}

const registerUser= asyncHandler(async (req,res)=>{
  //get user details
  //validation-not empty
  //check if user already exists:username,email
  //check  for images,check for avatar
  //upload them to cloudinary,avatar
  //create userobject-create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //check for user creation
  //return response
  const {fullName,email,username,password}=req.body//form json data
  console.log(email);
  
if([fullName,email,username,password].some((field)=>field?.trim()==="")){
  throw new ApiError(400,"full anme is required")
}

const existedUser= await User.findOne({
  $or:[
    {username},{email}
  ]
})
if(existedUser){
  throw new ApiError(409,"username or email already exists")
}
//middleware request ke andar aur fields  add kar deta hai
const avatarLocalPath=req.files?.avatar[0]?.path
const coverImageLocalPath=req.files?.coverImage[0]?.path
console.log(req.files);

//classic way toc heck whether the cover image is present or not
// let coverImageLocalPath
// if(req.files && Array.isArray(req.files.coverImage)&&
// req.files.coverImage.length>0){
// coverImageLocalPath=req.files.coverImage[0].path
// }

if (!avatarLocalPath) {
  throw new ApiError(400, "avatar is required")
}

 const avatar=await uploadOnCloudinary(avatarLocalPath)
const  coverImage= await uploadOnCloudinary(coverImageLocalPath)
if (!avatar) {
  throw new ApiError(500, "avatar upload failed") 
}
//create user inside database
 const user=await User.create({
fullName,
avatar:avatar.url,
coverImage:coverImage?.url||"",
email,
password,
username:username.toLowerCase()


})

  const createdUser=await User.findById(user._id).select(
    "-password -refreshToken"
  )
if (!createdUser) {
  throw new ApiError(500, "something went wrong while registering user")
}

return res.status(201).json(
  new ApiResponse(200,createdUser,"User registered successfully",

  )
)



}) 


const loginUser=asyncHandler(async(req,res)=>{
//req body->data 
//username or email
//find the user
//if user found->password check
//correct-> access and refresh token
//send cookie
const {email,username,password}=req.body
if (!(username||email)) {
  throw new ApiError(400,"username or password is required")
}
//find by email or username
 const user=await User.findOne({
  //or operator 
  $or:[{username},{email}]
})
if (!user) {
  throw new ApiError(404,"user doesnot exist")
}
// User ->  db find one  availabe through mongoose
//user -> current context all the custom methods written are available through this

const isPasswordValid= await user.isPasswordCorrect(password)
if (!isPasswordValid) {
  throw new ApiError(401,"invalid user credential")
}
const {accessToken,refreshToken}= await generateAccessAndrefreshTokens(user._id)

 const loggedInUser= await  User.findById(user._id).select(
  "-password -refreshToken"
 )//the fields that we donot want is eliminated by .select()
//cookies
 const options ={
  httpOnly:true,//can be only modified through server
  //cannot be modified using frontend
  secure:true
 }
 return res.status(200)
 .cookie("accessToken",accessToken,options)
 .cookie("refreshToken",refreshToken,options)
 .json(
  //user is trying to save the access token and the refresh token in the local machine
  new ApiResponse(
    200,
  {  user:loggedInUser,accessToken,
    refreshToken
  },
   "user logged in sucessfully"
  )
 )
})
const logoutUser=asyncHandler(async(req,res)=>{
 await  User.findByIdAndUpdate(
  req.user._id,{
    $set:{
      refreshToken:undefined
    }
  
  },
  {
    new:true
    //in return response we will get the new updated value
  }
 )

 const options={
  httpOnly:true,
  secure:true,
 }

 return  res
     .status(200)
     .clearCookie("accessToken",options)
     .clearCookie("refreshToken",options)
     .json(new ApiResponse(200,{},"User logged out"))
})
 
export {registerUser
  ,loginUser,
  logoutUser
}