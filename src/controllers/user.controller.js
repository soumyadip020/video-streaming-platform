import {asyncHandler} from "../utils/asyncHandler.js" 
import ApiError from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import ApiResponse from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

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
const refreshAccessToken=asyncHandler( async(req,res)=>{
 const incommingRefreshToken=  req.cookies.refreshToken||req.body.refreshToken
if(!incommingRefreshToken){
  throw new ApiError(401,"unauthorised request")
}
try {
   const decodedToken= jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
      const user=await User.findById(decodedToken?._id)
      if (!user) {
        throw new ApiError(401,"invalid refreshtoken")
      }
      if (incommingRefreshToken!== user?.refreshToken) {
        throw new ApiError(401,"refreshtoken is accessed or used")
      }
  
  const options={
    httpOnly:true,
    secure:true
  }
  const {accessToken,newrefreshToken}= await generateAccessAndrefreshTokens(user._id)
  
  return res
       .status(200)
       .cookie("accessToken",accessToken,options)
       .cookie("refreshToken",newrefreshToken,options)
       .json(
        new ApiResponse(
          200,
         {accessToken,refreshToken:newrefreshToken},
         "Access token refreshed"
        )
       )
} catch (error) {
  throw new ApiError(401,error?.message||"invalid refresh token")
}
})

const ChangeCurrentPassword=asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword}=req.body

  const user=  await User.findById(req.user?._id)
  const  isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

if(!isPasswordCorrect){throw new ApiError(400,"invalid password")}
user.password=newPassword
await user.save({validateBeforeSave: false});

return res
.status(200)
.json(new ApiResponse(200,{},"password changed sucessfully"))
})

const getCurrentUser=asyncHandler(async(req,res)=>{
  return res.status(200)
  .json(200,req.user,"current user fetched sucessfully")
})
const updateAccountDetails=asyncHandler(async(req,res)=>{
  const {fullName,email}=req.body
  if(!fullName||!email){
    throw new ApiError(400,"all fields are required")

  }

  const user =   User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullName,
        email:email

      }
    },
    {new:true}

  ).select("-password")
  return res.status(200)
  .json(new ApiResponse(200,user,"Account detaisl updated sucessfully"))
})
const updateUserAvatar=asyncHandler(async(req,res)=>{
 const avatarLocalPath= req.file?.path
 if (!avatarLocalPath) {
  throw new ApiError(400,"avatar file is missing ")
 }
  const avatar=  await uploadOnCloudinary(avatarLocalPath)
  if(!avatar.url){
    throw new ApiError(400,"error while uploadingn on avatar ")
  }

 const user= await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
  ).select("-password")

  return res.status(200).json(new ApiResponse(200,user,"avatar image uploaded sucessfully"))

})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
  const coverImageLocalPath= req.file?.path
  if (!coverImageLocalPath) {
   throw new ApiError(400,"coverImage file is missing ")
  }
   const coverImage=  await uploadOnCloudinary(coverImageLocalPath)
   if(!coverImage.url){
     throw new ApiError(400,"error while uploadingn on coverImage ")
   }
 
  const user= await User.findByIdAndUpdate(
     req.user?.id,
     {
       $set:{
         coverImage:coverImage.url
       }
     },
     {new:true}
   ).select("-password")
   return res.status(200).json(new ApiResponse(200,user,"cover image uploaded sucessfully"))
 
 })
 const getUserChannelProfile = asyncHandler(async(req,res)=>{
     const {username}=   req.params

    if(!username?.trim()){
      throw new ApiError(400,"username is missing")
    }
    const channel= await User.aggregate([{
      $match:{
        username:username?.toLowerCase()
      }
    },{
      $lookup:{
        from:"Subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup:{
        from:"Subscriptions",
        localField:"_id",
        foreignField:"subscriber ",
        as:"subscribedTo"
           }
    },{
      $addFields:{
        subscribersCount:{
          $size:"$subscribers"
        },
        channelsSubscribedToCount:{
          $size:"$subscribedTo"
        },
        isSubscribed:{
          $cond:{
            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
          
         then:true,
         else:false
          }
        }
      }
    },
{
  $project:{
    fullName:1,
    username:1,
    subscribersCount:1,
    channelsSubscribedToCount:1,
    avatar:1,
    coverImage:1,
    email:1


  }
}


  ])

if (!channel?.length) {
  throw new ApiError(404,"channel doesnot exist")
}
return res.status(200)
.json(
  new ApiResponse(200,channel[0],"user channel fetched sucessfully")
)


        
 })

const getWatchHistory=asyncHandler(async(req,res)=>{
 const user=await User.aggregate([
  {
    $match:{
      _id: new mongoose.Types.ObjectId(req.user._id)
    }
  },
  {
    $lookup:{
      from:"videos",
      localField:"watchHistory",
      foreignField:"_id",
      as:"watchHistory",
      pipeline:[
        {
          $lookup:{
            from:"users",
            localField:"owner",
            foreignField:"_id",
            as:"owner",
            pipeline:[
              {
                $project:{
                  fullName:1,
                  username:1,
                  avatar:1,

                }
              },
              {
                $addFields:{
                  owner:{
                    $first:"$owner"
                  }
                }
              }
            ]


          }
        }
      ]
    }
  }
 ])
 return res.status(200
  .json(
    new ApiResponse(200
      ,user[0].watchHistory,
      "watch history fetched  sucessfully"
    )
  )
 )
})

 
export {registerUser
  ,loginUser,
  logoutUser,
  refreshAccessToken,
  ChangeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,getUserChannelProfile,
  getWatchHistory
}