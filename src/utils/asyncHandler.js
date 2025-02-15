const asyncHandler = (requesthanddler)=>{
   return  (req,res,next)=>{
        Promise.resolve(
            requesthanddler(req,res,next)
        ).catch((err)=>next(err))
    }

}
export {asyncHandler}