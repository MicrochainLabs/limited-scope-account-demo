import { ENTRYPOINT_ADDRESS_V07,UserOperation,bundlerActions, getSenderAddress, signUserOperationHashWithECDSA } from "permissionless";
import { Address, createClient, createPublicClient, encodeFunctionData, Hex, http, parseEther } from "viem";
import { polygonAmoy } from "viem/chains";
import { pimlicoBundlerActions, pimlicoPaymasterActions } from "permissionless/actions/pimlico";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { AddressesIMT, SessionClaimsIMT } from "microch";



export async function deployNewAccountWithPaymaster(accountAllowedSmartContracts: string[], accountAllowedToAddressesTree: string[]){

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


    const SIMPLE_ACCOUNT_FACTORY_ADDRESS = "0xf8ef1786987e574b729304d4a1cf68bb69e91623"

    const ownerPrivateKey = generatePrivateKey()
    const owner = privateKeyToAccount(ownerPrivateKey)

    const factory = SIMPLE_ACCOUNT_FACTORY_ADDRESS
    const factoryData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "salt", type: "uint256" },
                ],
                name: "createAccount",
                outputs: [{ name: "ret", type: "address" }],
                stateMutability: "nonpayable",
                type: "function",
            },
        ],
        args: [owner.address, BigInt(0)],
    })

    const senderAddress = await getSenderAddress(publicClient, {
        factory,
        factoryData,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
    })

    const accountAllowedSmartContractTree: AddressesIMT = new AddressesIMT(17, 0, 2);
    for (let address of accountAllowedSmartContracts) {
        await accountAllowedSmartContractTree.addAddress(BigInt(address));
    }

    const accountAllowedToTree: AddressesIMT = new AddressesIMT(17, 0, 2);
    for (let address of accountAllowedToAddressesTree) {
        await accountAllowedToTree.addAddress(BigInt(address));
    }

    const accountTree = new SessionClaimsIMT(2, 0, 2);
    accountTree.addClaim(BigInt(senderAddress))
    accountTree.addClaim(accountAllowedSmartContractTree.root)
    accountTree.addClaim(accountAllowedToTree.root)
    accountTree.addClaim(BigInt(0))

    const callData = encodeFunctionData({
        abi: [
            {
                "inputs": [
                  {
                    "internalType": "uint256",
                    "name": "newAccountTreeRoot",
                    "type": "uint256"
                  }
                ],
                "name": "updateAccountMerkleTreeRoot",
                "outputs": [
                  {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                  }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
              }
        ],
        args: [accountTree.root]
      })

    const gasPrice = await bundlerClient.getUserOperationGasPrice()

    console.log("senderAddress", senderAddress)
    console.log("owner private key", ownerPrivateKey)

    const userOperation = {
        sender: senderAddress,
        nonce: BigInt(0),
        factory: factory as Address,
        factoryData,
        callData:callData,
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
        // dummy signature, needs to be there so the SimpleAccount doesn't immediately revert because of invalid signature length
        signature:
            "0xa15569dd8f8324dbeabf8073fdec36d4b754f53ce5901e283c6de79af177dc94557fa3c9922cd7af2a96ca94402d35c39f266925ee6407aeb32b31d76978d4ba1c" as Hex,
    }

    const sponsorUserOperationResult = await paymasterClient.sponsorUserOperation({
        userOperation,
    })
    
    const sponsoredUserOperation: UserOperation<"v0.7"> = {
        ...userOperation,
        ...sponsorUserOperationResult,
    }
    
    console.log("Received paymaster sponsor result:", sponsorUserOperationResult)

    const signature = await signUserOperationHashWithECDSA({
        account: owner,
        userOperation: sponsoredUserOperation,
        chainId: polygonAmoy.id,
        entryPoint: ENTRYPOINT_ADDRESS_V07,
    })
    sponsoredUserOperation.signature = signature

    const userOperationHash = await bundlerClient.sendUserOperation({
        userOperation: sponsoredUserOperation,
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
        accountIdentifier: senderAddress,
        ownerPrivateKey: ownerPrivateKey,
        accountAllowedSmartContracts: accountAllowedSmartContracts,
        accountAllowedToTree: accountAllowedToAddressesTree,
        txHash: txHash
    }
}