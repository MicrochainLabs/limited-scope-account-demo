import { AbiCoder, hexlify } from "ethers";
import { AddressesIMT, PROOF_SYSTEM_CONSTANTS } from "microch";
import { ENTRYPOINT_ADDRESS_V07, UserOperation, bundlerActions, getAccountNonce, getUserOperationHash, signUserOperationHashWithECDSA } from "permissionless";
import { pimlicoBundlerActions, pimlicoPaymasterActions } from "permissionless/actions/pimlico";
import { Address, Hex, createClient, createPublicClient, encodeFunctionData, http, parseEther } from "viem";
import { polygonAmoy } from "viem/chains";
// @ts-ignore
import * as snarkjs from 'snarkjs';
import { privateKeyToAccount } from "viem/accounts";

export async function sendTwoUserOperationWithPaymaster(to: string, amount: string, erc20TokenAddress: string, erc20ReceiverAccountAddress: string, erc20TokenAmount: string, accountIdentifier: string, accountOwnerPrivateKey: string, accountAllowedSmartContracts: string[], accountAllowedToAddresses: string[]){

     /*********************************** User operation preparation ***************************************** */  

     const publicClient = createPublicClient({
        transport: http("https://rpc-amoy.polygon.technology/"),
        chain: polygonAmoy,
    })
    
    const chain = "polygon-amoy";
    const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
    const endpointUrl = `https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`
    
    const bundlerClient = createClient({
        transport: http(endpointUrl),
        chain: polygonAmoy,
    })
        .extend(bundlerActions(ENTRYPOINT_ADDRESS_V07))
        .extend(pimlicoBundlerActions(ENTRYPOINT_ADDRESS_V07))
    
    const paymasterClient = createClient({
        transport: http(endpointUrl),
        chain: polygonAmoy,
    }).extend(pimlicoPaymasterActions(ENTRYPOINT_ADDRESS_V07))
    
    
    const decimals = 18
    const tokenAmount = BigInt(Number(erc20TokenAmount) * 10 ** decimals); // 50 token, adjust as needed
    
    const erc20CallData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                ],
                name: "transfer",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        args: [erc20ReceiverAccountAddress as `0x${string}`, tokenAmount]
    })

    // Convert currency unit from ether to wei
    const parsedAmountValue = parseEther(amount) //function paramter
    const data = "0x" 

    const executeBatchCallData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address[]" },
                    { name: "value", type: "uint256[]" },
                    { name: "func", type: "bytes[]" }
                ],
                name: "executeBatch",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        args: [[to as `0x${string}`, erc20TokenAddress as `0x${string}`], [parsedAmountValue, BigInt(0)], [data, erc20CallData]]

    });
      
    const owner = privateKeyToAccount(accountOwnerPrivateKey as Hex)
    const nonce = await getAccountNonce(publicClient, {
        sender: accountIdentifier as Address,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
    })
      const gasPrice = await bundlerClient.getUserOperationGasPrice()

      const userOperation = {
        sender: accountIdentifier,
        nonce: nonce,
        callData: executeBatchCallData,
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
        //verificationGasLimit:BigInt(280000),
        // dummy signature
        signature:
          "0x069c7ab8264bcef6681ce5cc1e54d14b5e29f083c3cfcb5a3721946fa7bbf60b245e0699d70a5718ff7d96f448d0634a94d4d6cf8700d048fec4c81a8a2376361b1dfa64dd0ab633eedb02349ea681ad37f102008442550e3d7b61b54861c4442f2ecd2e75911eaead169279a350caf51845db0895f5bfc6633630601c3a5c690cf4fafcc3de5c149866071d766ca0627d176504e6bf1f1b07a7fff08d2ae22d20efa20a72a82e3aad8f2547c1c7a77c0a41c2aa78a57b70dceeb0279bf0bd590d562834c2e044d9238fa7cae59d9ab4c2572f95de874cde1d4dc6d791b1c8d01abb1bfefc9a6d1eb972b57c24e227da48f51c03f921887d5d60c2025a72bf64228f35c2cadffcd04051bed9a7f5241fca1f800a3918b2399342448f272e283900000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000041491cb213e5675474d1255d57ebe12cd7487ffdace8dfecc91ab209c5a7e86dc458f20f4d6265b61810abc6db46788d9bb5ac4b4900a36b676efb6ef3a46e58de1b00000000000000000000000000000000000000000000000000000000000000" as Hex
    }
   
    const sponsorUserOperationResult = await paymasterClient.sponsorUserOperation({
        userOperation,
    })
    
    const sponsoredUserOperation: UserOperation<"v0.7"> = {
        ...userOperation,
        ...sponsorUserOperationResult,
    }

    console.log("Received paymaster sponsor result:", sponsorUserOperationResult)


    let userOpHash = getUserOperationHash({
        userOperation: sponsoredUserOperation,
        chainId: polygonAmoy.id,
        entryPoint: ENTRYPOINT_ADDRESS_V07
    })
    let op = BigInt(hexlify(userOpHash))
    op %= PROOF_SYSTEM_CONSTANTS.SNARK_SCALAR_FIELD


    /*********************************** User operation signature and proof generation ***************************************** */ 
    
    const transaction1= {
        dest: BigInt(to),
        value: amount,
        functionSelector: BigInt("0x0"),
        Erc20TransferTo: BigInt("0x0")
        }
    
    
        const transaction2= {
            dest: BigInt(erc20TokenAddress),
            value: "0",
            functionSelector: BigInt("0xa9059cbb"),
            Erc20TransferTo: BigInt(erc20ReceiverAccountAddress)
        }
    
        const transactions = [
            transaction1,
            transaction2
        ]
    
        const accountAllowedSmartContractTree: AddressesIMT = new AddressesIMT(17, 0, 2); 
        const accountAllowedToAddressesTree= new AddressesIMT(17, 0, 2); 
        
        for (let address of accountAllowedSmartContracts) {
            await accountAllowedSmartContractTree.addAddress(BigInt(address));
        }
    
        for (let address of accountAllowedToAddresses) {
            await accountAllowedToAddressesTree.addAddress(BigInt(address));
        }
        const circuitInputs = {
            accountIdentifier: BigInt(accountIdentifier),
            allowedSmartContractTreeRoot: accountAllowedSmartContractTree.root,
            allowedToTreeRoot: accountAllowedToAddressesTree.root,
            op: op,
            dest:[] as bigint[],
            value: [] as bigint[],
            functionSelector: [] as bigint[], 
            erc20TransferTo:[] as bigint[], 
            EthToSiblings: [] as number[][], 
            EthToPathIndices: [] as number[][],     
            allowedSmartContractCallSiblings: [] as number[][],
            allowedSmartContractCallPathIndices: [] as number[][],
            Erc20ToAddressSiblings: [] as number[][],
            Erc20ToAddressPathIndices: [] as number[][] 
        }
    
        for(let tx of transactions){
        
            circuitInputs.dest.push(tx.dest)
            circuitInputs.value.push(parseEther(tx.value))
            circuitInputs.functionSelector.push(tx.functionSelector)
            circuitInputs.erc20TransferTo.push(tx.Erc20TransferTo)
            if(tx.value != "0"){
              const index= await accountAllowedToAddressesTree.indexOf(BigInt(tx.dest));
              const allowedToProof= await accountAllowedToAddressesTree.generateMerkleProof(index);
              circuitInputs.EthToSiblings.push(allowedToProof.siblings)
              circuitInputs.EthToPathIndices.push(allowedToProof.pathIndices)
            }else{
              //static value
              circuitInputs.EthToSiblings.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
              circuitInputs.EthToPathIndices.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
            }
        
            if(tx.functionSelector != BigInt("0x0")){
              const index= await accountAllowedSmartContractTree.indexOf(BigInt(tx.dest));
              const allowedSmartContractProof= await accountAllowedSmartContractTree.generateMerkleProof(index);
              circuitInputs.allowedSmartContractCallSiblings.push(allowedSmartContractProof.siblings)
              circuitInputs.allowedSmartContractCallPathIndices.push(allowedSmartContractProof.pathIndices)
            }else{
              //static value
              circuitInputs.allowedSmartContractCallSiblings.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
              circuitInputs.allowedSmartContractCallPathIndices.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
            }
            if(tx.Erc20TransferTo != BigInt("0x0")){
              const index= await accountAllowedToAddressesTree.indexOf(BigInt(tx.Erc20TransferTo));
              const allowedSmartContractProof= await accountAllowedToAddressesTree.generateMerkleProof(index);
              circuitInputs.Erc20ToAddressSiblings.push(allowedSmartContractProof.siblings)
              circuitInputs.Erc20ToAddressPathIndices.push(allowedSmartContractProof.pathIndices)
            }else{
              //static value
              circuitInputs.Erc20ToAddressSiblings.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
              circuitInputs.Erc20ToAddressPathIndices.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
            }
        }
    
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs, "account_two_transaction_validation.wasm", "account_two_transaction_validation_0001.zkey");

      const signature = await signUserOperationHashWithECDSA({
        account: owner,
        userOperation: sponsoredUserOperation,
        chainId: polygonAmoy.id,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
    })

    const defaultEncode= AbiCoder.defaultAbiCoder();
    const finalSignature = defaultEncode.encode(
          ["uint256","uint256","uint256","uint256","uint256","uint256","uint256","uint256","uint256","bytes"],
          [proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1], publicSignals[1], signature]);
    sponsoredUserOperation.signature= finalSignature as `0x${string}`;


/*********************************** User operation submission ************************************************************* */

    const userOperationHash = await bundlerClient.sendUserOperation({
        userOperation: sponsoredUserOperation,
    })

    console.log("Received User Operation hash:", userOperationHash)

    console.log("Querying for receipts...")
    const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
    })
    const txHash = receipt.receipt.transactionHash

    console.log(`UserOperation included: https://amoy.polygonscan.com/tx/${txHash}`)

    return {
        txHash: txHash
    }
}


export async function sendTwoUserOperationWithoutPaymaster(to: string, amount: string, erc20TokenAddress: string, erc20ReceiverAccountAddress: string, erc20TokenAmount: string, accountIdentifier: string, sessionOwnerPrivateKey: string, sessionAllowedSmartContracts: string[], sessionAllowedToAddresses: string[]){

    /*********************************** User operation preparation ***************************************** */  

    const publicClient = createPublicClient({
        transport: http("https://rpc-amoy.polygon.technology/"),
        chain: polygonAmoy,
    })
    
    const chain = "polygon-amoy";
    const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
    const endpointUrl = `https://api.pimlico.io/v2/${chain}/rpc?apikey=${apiKey}`
    
    const bundlerClient = createClient({
        transport: http(endpointUrl),
        chain: polygonAmoy,
    })
        .extend(bundlerActions(ENTRYPOINT_ADDRESS_V07))
        .extend(pimlicoBundlerActions(ENTRYPOINT_ADDRESS_V07))


    const decimals = 18
    const tokenAmount = BigInt(Number(erc20TokenAmount) * 10 ** decimals); // 50 token, adjust as needed
    
    const erc20CallData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                ],
                name: "transfer",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        args: [erc20ReceiverAccountAddress as `0x${string}`, tokenAmount]
    })

    // Convert currency unit from ether to wei
    const parsedAmountValue = parseEther(amount) //function paramter
    const data = "0x" 

    const executeBatchCallData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "dest", type: "address[]" },
                    { name: "value", type: "uint256[]" },
                    { name: "func", type: "bytes[]" }
                ],
                name: "executeBatch",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        args: [[to as `0x${string}`, erc20TokenAddress as `0x${string}`], [parsedAmountValue, BigInt(0)], [data, erc20CallData]]

    });

    console.log("executeBatchCallData: ", executeBatchCallData)

    const sessionOwner = privateKeyToAccount(sessionOwnerPrivateKey as Hex)
    const nonce = await getAccountNonce(publicClient, {
        sender: accountIdentifier as Address,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
    })
    const gasPrice = await bundlerClient.getUserOperationGasPrice()

    const userOperation = {
        sender: accountIdentifier,
        nonce: nonce,
        callData: executeBatchCallData,
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
        callGasLimit: BigInt(118553),
        verificationGasLimit:BigInt(396851),
        preVerificationGas: BigInt(62164),
        // dummy signature
        signature:
          "0x150368ca9c94bbc38d4b23acf729d56d506d02c78f0acb2d7a2e17ec1e805eb90c21b496d5454316536ca5b3b8e96fce66828e5ebf997335ef4e4e8a7346c79d1c1be8d8725c70af471c9e8bffce0d172de36b6539481896cd31ddc837ebceca152a02be87fcc24f007b57664dcb084630007a67958d931d4ddd1485875ca69e09c07946a49194771c509a1665607fcb6ffd08de7742acb75d06542d7a363dcf1b43dd9647ad985ea6f3e9e96db31c08df531aa637b034c2f27b5a9ee1549ac8263f853d2ba00b458813b6150243fd72c6daac4341e700a854ba2c085cbd4ebd03b7673ef8b38234a31cc60c8fdfa0709de4802ee9642e3ebc367e8d30e998890c4a80cc0f06049d3dfba1f5047733e6e37de072870b3d949a9a8508c019602f00000000000000000000000022003c09cffb6d4e4964c4d967c078c228bd7cf3000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000414fe02330134e5c8cca47a8ab3ea4b38a5005df04ba243cd6b33d989abca6587233c756f1fb82513f2731d10518f83e79e93147bfa50bd7424ff404a168215a9d1c00000000000000000000000000000000000000000000000000000000000000" as Hex
    }

  
    let userOpHash = getUserOperationHash({
        userOperation: userOperation,
        chainId: polygonAmoy.id,
        entryPoint: ENTRYPOINT_ADDRESS_V07
    })
    let op = BigInt(hexlify(userOpHash))
    op %= PROOF_SYSTEM_CONSTANTS.SNARK_SCALAR_FIELD

   /*********************************** User operation signature/proof generation ***************************************** */ 

   const transaction1= {
    dest: BigInt(to),
    value: amount,
    functionSelector: BigInt("0x0"),
    Erc20TransferTo: BigInt("0x0")
    }


    const transaction2= {
        dest: BigInt(erc20TokenAddress),
        value: "0",
        functionSelector: BigInt("0xa9059cbb"),
        Erc20TransferTo: BigInt(erc20ReceiverAccountAddress)
    }

    const transactions = [
        transaction1,
        transaction2
    ]

    const sessionAllowedSmartContractTree: AddressesIMT = new AddressesIMT(17, 0, 2); 
    const sessionAllowedToAddressesTree= new AddressesIMT(17, 0, 2); 
    
    for (let address of sessionAllowedSmartContracts) {
        await sessionAllowedSmartContractTree.addAddress(BigInt(address));
    }

    for (let address of sessionAllowedToAddresses) {
        await sessionAllowedToAddressesTree.addAddress(BigInt(address));
    }
    const circuitInputs = {
        accountIdentifier: BigInt(accountIdentifier),
        sessionKeyIdentifier: BigInt(sessionOwner.address),
        allowedSmartContractTreeRoot: sessionAllowedSmartContractTree.root,
        allowedToTreeRoot: sessionAllowedToAddressesTree.root,
        op: op,
        dest:[] as bigint[],
        value: [] as bigint[],
        functionSelector: [] as bigint[], 
        erc20TransferTo:[] as bigint[], 
        EthToSiblings: [] as number[][], 
        EthToPathIndices: [] as number[][],     
        allowedSmartContractCallSiblings: [] as number[][],
        allowedSmartContractCallPathIndices: [] as number[][],
        Erc20ToAddressSiblings: [] as number[][],
        Erc20ToAddressPathIndices: [] as number[][] 
    }

    for(let tx of transactions){
    
        circuitInputs.dest.push(tx.dest)
        circuitInputs.value.push(parseEther(tx.value))
        circuitInputs.functionSelector.push(tx.functionSelector)
        circuitInputs.erc20TransferTo.push(tx.Erc20TransferTo)
        if(tx.value != "0"){
          const index= await sessionAllowedToAddressesTree.indexOf(BigInt(tx.dest));
          const allowedToProof= await sessionAllowedToAddressesTree.generateMerkleProof(index);
          circuitInputs.EthToSiblings.push(allowedToProof.siblings)
          circuitInputs.EthToPathIndices.push(allowedToProof.pathIndices)
        }else{
          //static value
          circuitInputs.EthToSiblings.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
          circuitInputs.EthToPathIndices.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
        }
    
        if(tx.functionSelector != BigInt("0x0")){
          const index= await sessionAllowedSmartContractTree.indexOf(BigInt(tx.dest));
          const allowedSmartContractProof= await sessionAllowedSmartContractTree.generateMerkleProof(index);
          circuitInputs.allowedSmartContractCallSiblings.push(allowedSmartContractProof.siblings)
          circuitInputs.allowedSmartContractCallPathIndices.push(allowedSmartContractProof.pathIndices)
        }else{
          //static value
          circuitInputs.allowedSmartContractCallSiblings.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
          circuitInputs.allowedSmartContractCallPathIndices.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
        }
        if(tx.Erc20TransferTo != BigInt("0x0")){
          const index= await sessionAllowedToAddressesTree.indexOf(BigInt(tx.Erc20TransferTo));
          const allowedSmartContractProof= await sessionAllowedToAddressesTree.generateMerkleProof(index);
          circuitInputs.Erc20ToAddressSiblings.push(allowedSmartContractProof.siblings)
          circuitInputs.Erc20ToAddressPathIndices.push(allowedSmartContractProof.pathIndices)
        }else{
          //static value
          circuitInputs.Erc20ToAddressSiblings.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
          circuitInputs.Erc20ToAddressPathIndices.push([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])
        }
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs, "account_two_transaction_validation.wasm", "account_two_transaction_validation_0001.zkey");


    const signature = await signUserOperationHashWithECDSA({
        account: sessionOwner,
        userOperation: userOperation,
        chainId: polygonAmoy.id,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
    })

    const defaultEncode= AbiCoder.defaultAbiCoder();
    const finalSignature = defaultEncode.encode(
          ["uint256","uint256","uint256","uint256","uint256","uint256","uint256","uint256","uint256","address","bytes"],
          [proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1], publicSignals[1], sessionOwner.address, signature]);
          userOperation.signature= finalSignature as `0x${string}`;

    console.log("userOpHash: ", userOpHash)
    console.log("calldata: ", executeBatchCallData)
    console.log("signature: ", finalSignature)

    /*********************************** User operation submission ************************************************************* */

    const userOperationHash = await bundlerClient.sendUserOperation({
        userOperation: userOperation,
    })

    console.log("Received User Operation hash:", userOperationHash)

    // let's also wait for the userOperation to be included, by continually querying for the receipts
    console.log("Querying for receipts...")
    const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
    })
    const txHash = receipt.receipt.transactionHash

    console.log(`UserOperation included: https://amoy.polygonscan.com/tx/${txHash}`)

    return {
        txHash: txHash
    }
}
