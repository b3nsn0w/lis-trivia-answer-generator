# count the number of occurrences of "[x] Keep" in files in the question-evaluations directory 

# get the number of files in the directory
numfiles=$(ls -1 question-evaluations | wc -l)
total=0

# get the number of occurrences of "[x] Keep" in each file
for i in $(seq 1 $numfiles)
do
    numkept=$(grep -c "\[x\] Keep" question-evaluations/questions-$i.md)
    total=$((total + numkept))
    echo $numkept
done

# print the total number of occurrences of "[x] Keep"
echo "Total: $total"