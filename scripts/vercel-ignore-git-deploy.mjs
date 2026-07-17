const isGitDeployment = Boolean(process.env.VERCEL_GIT_COMMIT_SHA);

if (isGitDeployment) {
  console.log("Git自動デプロイは停止し、データベースのマイグレーション後にCIからデプロイします。");
  process.exit(0);
}

// Git外からのCLIデプロイは通常どおり許可する。
process.exit(1);
